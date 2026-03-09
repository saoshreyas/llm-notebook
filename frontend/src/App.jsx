import { useState, useEffect, useCallback, useRef } from 'react'
import NotebookCell from './components/NotebookCell'
import CommandBar from './components/CommandBar'
import InfoPanel from './components/InfoPanel'

const API = '/api'

// Cell states for the two-stage execution model
const CELL_STATE = {
  IDLE: 'idle',
  TRANSLATING: 'translating',
  TRANSLATED: 'translated',
  INTERPRETING: 'interpreting',
  COMPLETE: 'complete',
  ERROR: 'error',
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function createCell() {
  return {
    id: generateId(),
    input: '',
    translatedText: null,
    balloonCount: 0,
    balloonImages: [],
    state: CELL_STATE.IDLE,
    error: null,
    executionNumber: null,
    translateTime: null,
    interpretTime: null,
  }
}

export default function App() {
  const [cells, setCells] = useState([createCell()])
  const [executionCounter, setExecutionCounter] = useState(0)
  const [focusedCellId, setFocusedCellId] = useState(null)
  const [apiStatus, setApiStatus] = useState({ ok: false, checking: true, message: 'Checking...' })
  const [showCommandBar, setShowCommandBar] = useState(false)
  const cellRefs = useRef({})

  // Health check
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API}/health`)
        const data = await res.json()
        setApiStatus({
          ok: data.status === 'healthy',
          checking: false,
          message: data.status === 'healthy'
            ? (data.vllm_configured ? 'Connected' : 'API Ready')
            : 'Unhealthy',
        })
      } catch {
        setApiStatus({ ok: false, checking: false, message: 'Disconnected' })
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  // Update a single cell in state
  const updateCell = useCallback((cellId, patch) => {
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, ...patch } : c))
  }, [])

  // Stage 1: Translate
  const translateCell = useCallback(async (cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell || !cell.input.trim()) return

    const num = executionCounter + 1
    setExecutionCounter(num)
    updateCell(cellId, {
      state: CELL_STATE.TRANSLATING,
      error: null,
      executionNumber: num,
      translatedText: null,
      balloonCount: 0,
      balloonImages: [],
      interpretTime: null,
    })

    try {
      const res = await fetch(`${API}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cell.input }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Translation failed' }))
        throw new Error(err.detail || 'Translation failed')
      }
      const data = await res.json()
      updateCell(cellId, {
        state: CELL_STATE.TRANSLATED,
        translatedText: data.translated_text,
        translateTime: data.processing_time,
      })
    } catch (err) {
      updateCell(cellId, { state: CELL_STATE.ERROR, error: err.message })
    }
  }, [cells, executionCounter, updateCell])

  // Stage 2: Interpret
  const interpretCell = useCallback(async (cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell || !cell.translatedText) return

    updateCell(cellId, { state: CELL_STATE.INTERPRETING, error: null })

    try {
      const res = await fetch(`${API}/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cell.translatedText }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Interpretation failed' }))
        throw new Error(err.detail || 'Interpretation failed')
      }
      const data = await res.json()
      updateCell(cellId, {
        state: CELL_STATE.COMPLETE,
        balloonCount: data.balloon_count,
        balloonImages: data.balloon_images,
        interpretTime: data.processing_time,
      })
    } catch (err) {
      updateCell(cellId, { state: CELL_STATE.ERROR, error: err.message })
    }
  }, [cells, updateCell])

  // Run cell: translate if idle/error, interpret if translated
  const runCell = useCallback((cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell) return
    if (cell.state === CELL_STATE.IDLE || cell.state === CELL_STATE.ERROR || cell.state === CELL_STATE.COMPLETE) {
      translateCell(cellId)
    } else if (cell.state === CELL_STATE.TRANSLATED) {
      interpretCell(cellId)
    }
  }, [cells, translateCell, interpretCell])

  // Clear cell output
  const clearCell = useCallback((cellId) => {
    updateCell(cellId, {
      state: CELL_STATE.IDLE,
      translatedText: null,
      balloonCount: 0,
      balloonImages: [],
      error: null,
      executionNumber: null,
      translateTime: null,
      interpretTime: null,
    })
  }, [updateCell])

  // Add cell after a given cell (or at the end)
  const addCellAfter = useCallback((afterId) => {
    setCells(prev => {
      const newCell = createCell()
      if (!afterId) return [...prev, newCell]
      const idx = prev.findIndex(c => c.id === afterId)
      if (idx === -1) return [...prev, newCell]
      const next = [...prev]
      next.splice(idx + 1, 0, newCell)
      // Focus the new cell after render
      setTimeout(() => {
        setFocusedCellId(newCell.id)
        cellRefs.current[newCell.id]?.focus()
      }, 50)
      return next
    })
  }, [])

  // Delete cell
  const deleteCell = useCallback((cellId) => {
    setCells(prev => {
      if (prev.length <= 1) return prev
      const idx = prev.findIndex(c => c.id === cellId)
      const next = prev.filter(c => c.id !== cellId)
      // Focus adjacent cell
      const focusIdx = Math.min(idx, next.length - 1)
      setTimeout(() => {
        const nextCell = next[focusIdx]
        if (nextCell) {
          setFocusedCellId(nextCell.id)
          cellRefs.current[nextCell.id]?.focus()
        }
      }, 50)
      return next
    })
  }, [])

  // Set input for a cell
  const setCellInput = useCallback((cellId, input) => {
    updateCell(cellId, { input })
  }, [updateCell])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Ctrl+/ — toggle command bar
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        setShowCommandBar(prev => !prev)
        return
      }

      // Esc — close command bar
      if (e.key === 'Escape') {
        if (showCommandBar) {
          e.preventDefault()
          setShowCommandBar(false)
        }
        return
      }

      // Alt+A — add cell below focused
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        addCellAfter(focusedCellId || cells[cells.length - 1]?.id)
        return
      }

      // Alt+D — delete focused cell
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        if (focusedCellId && cells.length > 1) {
          deleteCell(focusedCellId)
        }
        return
      }

      // Shift+Enter — run current focused cell
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        if (focusedCellId) runCell(focusedCellId)
        return
      }

      // Ctrl+Enter — run cell and insert new cell below
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (focusedCellId) {
          runCell(focusedCellId)
          addCellAfter(focusedCellId)
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusedCellId, cells, showCommandBar, runCell, addCellAfter, deleteCell])

  return (
    <div className="min-h-screen bg-white">
      {/* Jupyter-style Header */}
      <header className="border-b border-[#CFCFCF] bg-white">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="4" fill="#FF6B19" />
                <text x="5" y="20" fontFamily="monospace" fontSize="14" fill="white" fontWeight="bold">Jn</text>
              </svg>
              <span className="text-lg font-semibold text-[#333]">Jupyter</span>
            </div>
            <span className="text-[#777] text-sm">|</span>
            <span className="text-sm text-[#333]">Untitled.ipynb</span>
          </div>

          <div className="flex items-center gap-3">
            {/* API Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border ${
              apiStatus.checking
                ? 'border-gray-300 bg-gray-50 text-gray-500'
                : apiStatus.ok
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-red-300 bg-red-50 text-red-700'
            }`}>
              <span className={`inline-block w-2 h-2 rounded-full ${
                apiStatus.checking ? 'bg-gray-400' : apiStatus.ok ? 'bg-green-500' : 'bg-red-500'
              }`} />
              {apiStatus.message}
            </div>

            {/* Shortcuts button */}
            <button
              onClick={() => setShowCommandBar(true)}
              className="px-3 py-1.5 text-xs font-medium rounded border border-[#CFCFCF] bg-[#F7F7F7] hover:bg-[#E8E8E8] text-[#333] transition-colors"
            >
              Shortcuts
            </button>
          </div>
        </div>

        {/* Jupyter-style toolbar */}
        <div className="flex items-center gap-1 px-4 py-1.5 bg-[#F7F7F7] border-t border-[#CFCFCF]">
          <ToolbarButton label="Cell" />
          <ToolbarButton label="Kernel" />
          <span className="text-[#CFCFCF] mx-1">|</span>
          <span className="text-xs text-[#777] font-mono">
            Two-Stage Processing: Translate → Interpret
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1100px] mx-auto px-4 py-6">
        {/* Info panel */}
        <InfoPanel />

        {/* Cells */}
        <div className="mt-4">
          {cells.map((cell, index) => (
            <div key={cell.id}>
              <NotebookCell
                ref={(el) => { cellRefs.current[cell.id] = el }}
                cell={cell}
                isFocused={focusedCellId === cell.id}
                onFocus={() => setFocusedCellId(cell.id)}
                onRun={() => runCell(cell.id)}
                onClear={() => clearCell(cell.id)}
                onDelete={() => deleteCell(cell.id)}
                onInputChange={(val) => setCellInput(cell.id, val)}
                canDelete={cells.length > 1}
                cellState={CELL_STATE}
              />

              {/* Insert Cell Below button between cells */}
              <div className="flex justify-center py-1 group">
                <button
                  onClick={() => addCellAfter(cell.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-[#777] hover:text-[#FF6B19] border border-transparent hover:border-[#CFCFCF] rounded px-3 py-0.5 bg-transparent hover:bg-[#F7F7F7]"
                >
                  + Insert Cell Below
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add cell button at bottom */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() => addCellAfter(cells[cells.length - 1]?.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded border border-[#CFCFCF] bg-[#F7F7F7] hover:bg-[#E8E8E8] text-[#333] transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add Cell
          </button>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-[#E8E8E8] text-center text-xs text-[#999] font-mono">
          LLM Notebook &middot; FastAPI + vLLM + React &middot; Two-Stage Processing
        </footer>
      </main>

      {/* Command bar modal */}
      {showCommandBar && <CommandBar onClose={() => setShowCommandBar(false)} />}
    </div>
  )
}

function ToolbarButton({ label }) {
  return (
    <button className="px-2.5 py-0.5 text-xs text-[#333] hover:bg-[#E8E8E8] rounded transition-colors">
      {label}
    </button>
  )
}
