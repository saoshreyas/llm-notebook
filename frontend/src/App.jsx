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
  PARTIAL: 'partial',
  ERROR: 'error',
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function buildNotebookHistory(cells, currentCellId) {
  const idx = cells.findIndex((c) => c.id === currentCellId)
  if (idx <= 0) return []
  return cells.slice(0, idx).map((c) => {
    const outputs = {}
    if (c.nodes) {
      for (const n of c.nodes) {
        if (n.success && n.output_name && n.output_value != null) {
          outputs[n.output_name] = n.output_value
        }
      }
    }
    return {
      natural_language: c.input?.trim() ? c.input : null,
      dsl_source: c.dslSource?.trim() ? c.dslSource : null,
      summary: c.success === false ? 'prior cell had failures' : null,
      outputs: Object.keys(outputs).length ? outputs : null,
    }
  })
}

function createCell() {
  return {
    id: generateId(),
    mode: 'text',
    input: '',
    state: CELL_STATE.IDLE,
    error: null,
    executionNumber: null,
    translateTime: null,
    interpretTime: null,
    dslSource: '',
    nodes: null,
    success: null,
    syntaxError: null,
  }
}

export default function App() {
  const [cells, setCells] = useState([createCell()])
  const [executionCounter, setExecutionCounter] = useState(0)
  const [focusedCellId, setFocusedCellId] = useState(null)
  const [apiStatus, setApiStatus] = useState({ ok: false, checking: true, message: 'Checking...' })
  const [showCommandBar, setShowCommandBar] = useState(false)
  const cellRefs = useRef({})
  const syntaxTimers = useRef({})

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API}/health`)
        const data = await res.json()
        const ready = data.status === 'healthy'
        setApiStatus({
          ok: ready,
          checking: false,
          message: ready
            ? (data.openrouter_configured ? 'OpenRouter' : (data.vllm_base_url ? 'vLLM' : 'API Ready'))
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
    setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, ...patch } : c)))
  }, [])

  const checkSyntax = useCallback(async (cellId, source) => {
    if (!source?.trim()) {
      updateCell(cellId, { syntaxError: null })
      return
    }
    try {
      const res = await fetch(`${API}/workflow/check_syntax`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      const data = await res.json()
      updateCell(cellId, { syntaxError: data.ok ? null : data.error })
    } catch {
      /* ignore network blips for live check */
    }
  }, [updateCell])

  const scheduleSyntaxCheck = useCallback((cellId, source) => {
    if (syntaxTimers.current[cellId]) clearTimeout(syntaxTimers.current[cellId])
    syntaxTimers.current[cellId] = setTimeout(() => checkSyntax(cellId, source), 400)
  }, [checkSyntax])

  const translateCell = useCallback(async (cellId) => {
    const cell = cells.find((c) => c.id === cellId)
    if (!cell || !cell.input.trim()) {
      toast.warning('Enter natural language before running.')
      return
    }
    const num = executionCounter + 1
    setExecutionCounter(num)
    updateCell(cellId, {
      state: CELL_STATE.TRANSLATING,
      error: null,
      executionNumber: num,
      dslSource: '',
      nodes: null,
      success: null,
      interpretTime: null,
    })
    try {
      const res = await fetch(`${API}/workflow/nl_to_dsl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cell.input,
          notebook_history: buildNotebookHistory(cells, cellId),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'NL→DSL failed' }))
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
      }
      const data = await res.json()
      updateCell(cellId, {
        state: CELL_STATE.TRANSLATED,
        dslSource: data.dsl_source,
        translateTime: data.processing_time,
        syntaxError: data.parse_ok === false ? data.parse_error : null,
      })
      if (data.parse_ok === false && data.parse_error) {
        toast.warning(
          `After ${data.parse_attempts ?? 1} attempt(s) DSL still does not parse — edit .wfl or retry. ${data.parse_error}`,
          { duration: 8000 },
        )
      } else {
        const attempts = data.parse_attempts ?? 1
        toast.success(
          attempts > 1
            ? `Valid after ${attempts} attempt(s). Run again to interpret.`
            : 'DSL ready — run again to interpret.',
          { duration: 4000 },
        )
      }
    } catch (err) {
      updateCell(cellId, { state: CELL_STATE.ERROR, error: err.message })
      toast.error(`NL→DSL failed: ${err.message}`)
    }
  }, [cells, executionCounter, updateCell])

  const interpretCell = useCallback(async (cellId) => {
    const cell = cells.find((c) => c.id === cellId)
    if (!cell || !cell.dslSource?.trim()) {
      toast.warning('No workflow DSL yet.')
      return
    }
    const num = cell.executionNumber || executionCounter + 1
    if (!cell.executionNumber) setExecutionCounter(num)
    const t0 = Date.now()
    updateCell(cellId, {
      state: CELL_STATE.INTERPRETING,
      error: null,
      executionNumber: num,
      nodes: null,
      success: null,
      interpretTime: null,
    })
    try {
      const body = {
        source: cell.dslSource,
        notebook_history: buildNotebookHistory(cells, cellId),
      }
      // Text mode often has a free-form task in `input` — pass as {{task}}
      if (cell.mode === 'text' && cell.input?.trim()) {
        body.inputs = { task: cell.input.trim() }
      }
      const res = await fetch(`${API}/workflow/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Workflow run failed' }))
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
      }
      const data = await res.json()
      const interpretTime = ((Date.now() - t0) / 1000).toFixed(1)
      updateCell(cellId, {
        state: data.success ? CELL_STATE.COMPLETE : CELL_STATE.PARTIAL,
        nodes: data.nodes,
        success: data.success,
        interpretTime,
      })
      if (data.success) {
        toast.success('Workflow interpreted successfully.')
      } else {
        const failed = data.nodes.filter((n) => !n.success).length
        toast.warning(`${failed} node(s) failed — see output below.`)
      }
    } catch (err) {
      updateCell(cellId, { state: CELL_STATE.ERROR, error: err.message })
      toast.error(`Interpret failed: ${err.message}`)
    }
  }, [cells, executionCounter, updateCell])

  const runTextCell = useCallback((cellId) => {
    const cell = cells.find((c) => c.id === cellId)
    if (!cell) return
    const restart = [CELL_STATE.IDLE, CELL_STATE.ERROR, CELL_STATE.COMPLETE, CELL_STATE.PARTIAL].includes(cell.state)
    if (restart) translateCell(cellId)
    else if (cell.state === CELL_STATE.TRANSLATED) interpretCell(cellId)
  }, [cells, translateCell, interpretCell])

  const runDSLCell = useCallback((cellId) => {
    const cell = cells.find((c) => c.id === cellId)
    if (!cell) return
    interpretCell(cellId)
  }, [cells, interpretCell])

  const runCell = useCallback((cellId) => {
    const cell = cells.find((c) => c.id === cellId)
    if (!cell) return
    cell.mode === 'dsl' ? runDSLCell(cellId) : runTextCell(cellId)
  }, [cells, runDSLCell, runTextCell])

  const toggleCellMode = useCallback((cellId) => {
    const cell = cells.find((c) => c.id === cellId)
    if (!cell) return
    const newMode = cell.mode === 'text' ? 'dsl' : 'text'
    updateCell(cellId, {
      mode: newMode,
      state: CELL_STATE.IDLE,
      error: null,
      nodes: null,
      success: null,
      syntaxError: null,
    })
    toast(`Switched to ${newMode === 'dsl' ? 'DSL' : 'Text'} mode.`, { duration: 1500 })
  }, [cells, updateCell])

  const clearCell = useCallback((cellId) => {
    updateCell(cellId, {
      state: CELL_STATE.IDLE,
      dslSource: '',
      error: null,
      executionNumber: null,
      translateTime: null,
      interpretTime: null,
      nodes: null,
      success: null,
      syntaxError: null,
    })
    toast('Cell cleared.', { duration: 1500 })
  }, [updateCell])

  const addCellAfter = useCallback((afterId) => {
    setCells((prev) => {
      const newCell = createCell()
      if (!afterId) return [...prev, newCell]
      const idx = prev.findIndex((c) => c.id === afterId)
      if (idx === -1) return [...prev, newCell]
      const next = [...prev]
      next.splice(idx + 1, 0, newCell)
      setTimeout(() => {
        setFocusedCellId(newCell.id)
        cellRefs.current[newCell.id]?.focus()
      }, 50)
      return next
    })
    toast('Cell added.', { duration: 1500 })
  }, [])

  const deleteCell = useCallback((cellId) => {
    setCells((prev) => {
      if (prev.length <= 1) {
        toast.warning('Cannot delete the last cell.')
        return prev
      }
      const idx = prev.findIndex((c) => c.id === cellId)
      const next = prev.filter((c) => c.id !== cellId)
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
    toast('Cell deleted.', { duration: 1500 })
  }, [])

  const setCellInput = useCallback((id, v) => updateCell(id, { input: v }), [updateCell])
  const setDSLSource = useCallback((id, v) => {
    updateCell(id, { dslSource: v })
    scheduleSyntaxCheck(id, v)
  }, [updateCell, scheduleSyntaxCheck])

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShowCommandBar((p) => !p); return }
      if (e.key === 'Escape') { if (showCommandBar) { e.preventDefault(); setShowCommandBar(false) }; return }
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault(); addCellAfter(focusedCellId || cells[cells.length - 1]?.id); return
      }
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        if (focusedCellId && cells.length > 1) deleteCell(focusedCellId)
        else if (cells.length <= 1) toast.warning('Cannot delete the last cell.')
        return
      }
      if (e.shiftKey && e.key === 'Enter') { e.preventDefault(); if (focusedCellId) runCell(focusedCellId); return }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (focusedCellId) { runCell(focusedCellId); addCellAfter(focusedCellId) }
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
        <header className="border-b bg-background sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="4" fill="#FF6B19" />
                  <text x="5" y="20" fontFamily="monospace" fontSize="14" fill="white" fontWeight="bold">Jn</text>
                </svg>
                <span className="text-lg font-semibold">NotebookLM</span>
              </div>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-sm">Untitled.wfl.ipynb</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant} className="gap-1.5 font-mono">
                <CircleDot className="h-2.5 w-2.5" />
                {apiStatus.message}
              </Badge>
              <Button variant="jupyter-outline" size="sm" onClick={() => setShowCommandBar(true)} className="gap-1.5">
                <Keyboard className="h-3.5 w-3.5" />
                Shortcuts
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-muted/50 border-t">
            <span className="text-xs text-muted-foreground font-mono">
              Text: NL → .wfl → interpret · DSL: write .wfl → interpret · OpenRouter via LiteLLM
            </span>
          </div>
        </header>

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
                  onTranslate={() => translateCell(cell.id)}
                  onInterpret={() => interpretCell(cell.id)}
                  onClear={() => clearCell(cell.id)}
                  onDelete={() => deleteCell(cell.id)}
                  onToggleMode={() => toggleCellMode(cell.id)}
                  onInputChange={(v) => setCellInput(cell.id, v)}
                  onDSLSourceChange={(v) => setDSLSource(cell.id, v)}
                  onDSLBlur={() => checkSyntax(cell.id, cell.dslSource)}
                  canDelete={cells.length > 1}
                />
                <div className="flex justify-center py-1 group">
                  <Button
                    variant="ghost" size="xs"
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

          <div className="flex justify-center mt-4">
            <Button
              variant="jupyter-outline" size="default"
              onClick={() => addCellAfter(cells[cells.length - 1]?.id)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Cell
            </Button>
          </div>

          <Separator className="mt-8" />
          <footer className="py-4 text-center text-xs text-muted-foreground font-mono">
            NotebookLM · FastAPI + OpenRouter + React · Workflow DSL
          </footer>
        </main>

        <CommandBar open={showCommandBar} onOpenChange={setShowCommandBar} />
        <Toaster position="bottom-right" richColors />
      </div>
    </TooltipProvider>
  )
}
