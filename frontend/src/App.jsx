import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Keyboard, CircleDot } from 'lucide-react'
import { toast } from 'sonner'

import NotebookCell from './components/NotebookCell'
import CommandBar from './components/CommandBar'
import InfoPanel from './components/InfoPanel'

import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Separator } from './components/ui/separator'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'

const API = '/api'

export const CELL_STATE = {
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

  const updateCell = useCallback((cellId, patch) => {
    setCells(prev => prev.map(c => c.id === cellId ? { ...c, ...patch } : c))
  }, [])

  const translateCell = useCallback(async (cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell || !cell.input.trim()) {
      toast.warning('Please enter some text before running.')
      return
    }

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
      toast.success('Stage 1 complete — press run again to interpret.', { duration: 3000 })
    } catch (err) {
      updateCell(cellId, { state: CELL_STATE.ERROR, error: err.message })
      toast.error(`Translation failed: ${err.message}`)
    }
  }, [cells, executionCounter, updateCell])

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
      if (data.balloon_count > 0) {
        toast.success(`Found ${data.balloon_count} balloon${data.balloon_count !== 1 ? 's' : ''}!`)
      } else {
        toast('No balloons found in the text.', { icon: '🔍' })
      }
    } catch (err) {
      updateCell(cellId, { state: CELL_STATE.ERROR, error: err.message })
      toast.error(`Interpretation failed: ${err.message}`)
    }
  }, [cells, updateCell])

  const runCell = useCallback((cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell) return
    if (cell.state === CELL_STATE.IDLE || cell.state === CELL_STATE.ERROR || cell.state === CELL_STATE.COMPLETE) {
      translateCell(cellId)
    } else if (cell.state === CELL_STATE.TRANSLATED) {
      interpretCell(cellId)
    }
  }, [cells, translateCell, interpretCell])

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
    toast('Cell cleared.', { icon: '🧹', duration: 1500 })
  }, [updateCell])

  const addCellAfter = useCallback((afterId) => {
    setCells(prev => {
      const newCell = createCell()
      if (!afterId) return [...prev, newCell]
      const idx = prev.findIndex(c => c.id === afterId)
      if (idx === -1) return [...prev, newCell]
      const next = [...prev]
      next.splice(idx + 1, 0, newCell)
      setTimeout(() => {
        setFocusedCellId(newCell.id)
        cellRefs.current[newCell.id]?.focus()
      }, 50)
      return next
    })
    toast('Cell added.', { icon: '➕', duration: 1500 })
  }, [])

  const deleteCell = useCallback((cellId) => {
    setCells(prev => {
      if (prev.length <= 1) {
        toast.warning('Cannot delete the last cell.')
        return prev
      }
      const idx = prev.findIndex(c => c.id === cellId)
      const next = prev.filter(c => c.id !== cellId)
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
    toast('Cell deleted.', { icon: '🗑️', duration: 1500 })
  }, [])

  const setCellInput = useCallback((cellId, input) => {
    updateCell(cellId, { input })
  }, [updateCell])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault()
        setShowCommandBar(prev => !prev)
        return
      }
      if (e.key === 'Escape') {
        if (showCommandBar) {
          e.preventDefault()
          setShowCommandBar(false)
        }
        return
      }
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        addCellAfter(focusedCellId || cells[cells.length - 1]?.id)
        return
      }
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        if (focusedCellId && cells.length > 1) {
          deleteCell(focusedCellId)
        } else if (cells.length <= 1) {
          toast.warning('Cannot delete the last cell.')
        }
        return
      }
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        if (focusedCellId) runCell(focusedCellId)
        return
      }
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

  const statusVariant = apiStatus.checking ? 'checking' : apiStatus.ok ? 'connected' : 'disconnected'

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        {/* Jupyter-style header */}
        <header className="border-b bg-background sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="4" fill="#FF6B19" />
                  <text x="5" y="20" fontFamily="monospace" fontSize="14" fill="white" fontWeight="bold">Jn</text>
                </svg>
                <span className="text-lg font-semibold">Jupyter</span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-sm">Untitled.ipynb</span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={statusVariant} className="gap-1.5 font-mono">
                <CircleDot className="h-2.5 w-2.5" />
                {apiStatus.message}
              </Badge>

              <Button
                variant="jupyter-outline"
                size="sm"
                onClick={() => setShowCommandBar(true)}
                className="gap-1.5"
              >
                <Keyboard className="h-3.5 w-3.5" />
                Shortcuts
              </Button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-muted/50 border-t">
            <Button variant="jupyter-ghost" size="xs">Cell</Button>
            <Button variant="jupyter-ghost" size="xs">Kernel</Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <span className="text-xs text-muted-foreground font-mono">
              Two-Stage Processing: Translate → Interpret
            </span>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-[1100px] mx-auto px-4 py-6">
          <InfoPanel />

          <div className="mt-4">
            {cells.map((cell) => (
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
                />

                {/* Insert Cell Below */}
                <div className="flex justify-center py-1 group">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => addCellAfter(cell.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-[#FF6B19] gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Insert Cell Below
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Cell */}
          <div className="flex justify-center mt-4">
            <Button
              variant="jupyter-outline"
              size="default"
              onClick={() => addCellAfter(cells[cells.length - 1]?.id)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Cell
            </Button>
          </div>

          <Separator className="mt-8" />
          <footer className="py-4 text-center text-xs text-muted-foreground font-mono">
            LLM Notebook &middot; FastAPI + vLLM + React &middot; Two-Stage Processing
          </footer>
        </main>

        {/* Command bar dialog */}
        <CommandBar open={showCommandBar} onOpenChange={setShowCommandBar} />

        {/* Toast notifications */}
        <Toaster position="bottom-right" richColors />
      </div>
    </TooltipProvider>
  )
}
