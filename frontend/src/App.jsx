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
  // ── text-mode states (unchanged) ──────────────────────────────────────────
  IDLE:         'idle',
  TRANSLATING:  'translating',
  TRANSLATED:   'translated',
  INTERPRETING: 'interpreting',
  COMPLETE:     'complete',
  ERROR:        'error',
  // ── DSL-mode states ────────────────────────────────────────────────────────
  // Stage 1: generating + verifying code
  DSL_GENERATING:  'dsl_generating',
  // Stage 2: code ready, user can edit before running
  DSL_CODE_READY:  'dsl_code_ready',
  // Stage 3: executing the code
  DSL_EXECUTING:   'dsl_executing',
  // Done
  DSL_COMPLETE:    'dsl_complete',
  DSL_PARTIAL:     'dsl_partial',   // some nodes failed verification
  DSL_ERROR:       'dsl_error',
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function createCell() {
  return {
    id:              generateId(),
    mode:            'text',        // 'text' | 'dsl'
    // ── text-mode fields ────────────────────────────────────────────────────
    input:           '',
    translatedText:  null,
    balloonCount:    0,
    balloonImages:   [],
    state:           CELL_STATE.IDLE,
    error:           null,
    executionNumber: null,
    translateTime:   null,
    interpretTime:   null,
    // ── dsl-mode fields ─────────────────────────────────────────────────────
    dslSource:       '',            // what the user writes in the DSL textarea
    dslCells:        null,          // array of node results from Stage 1
    dslEditableCode: null,          // flat string of all generated code — user edits this
    dslExecOutput:   null,          // stdout + result from Stage 3
    dslExecError:    null,          // error from Stage 3
    dslGenerateTime: null,
    dslExecTime:     null,
  }
}

export default function App() {
  const [cells, setCells] = useState([createCell()])
  const [executionCounter, setExecutionCounter] = useState(0)
  const [focusedCellId, setFocusedCellId] = useState(null)
  const [apiStatus, setApiStatus] = useState({ ok: false, checking: true, message: 'Checking...' })
  const [showCommandBar, setShowCommandBar] = useState(false)
  const cellRefs = useRef({})

  // ── Health check ───────────────────────────────────────────────────────────
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

  // ── Text-mode: Stage 1 translate ───────────────────────────────────────────
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

  // ── Text-mode: Stage 2 interpret ──────────────────────────────────────────
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

  const runTextCell = useCallback((cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell) return
    if (
      cell.state === CELL_STATE.IDLE ||
      cell.state === CELL_STATE.ERROR ||
      cell.state === CELL_STATE.COMPLETE
    ) {
      translateCell(cellId)
    } else if (cell.state === CELL_STATE.TRANSLATED) {
      interpretCell(cellId)
    }
  }, [cells, translateCell, interpretCell])

  // ── DSL-mode: Stage 1 — generate + verify code ────────────────────────────
  const dslGenerateCell = useCallback(async (cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell || !cell.dslSource.trim()) {
      toast.warning('Please enter a pipeline before running.')
      return
    }
    const num = executionCounter + 1
    setExecutionCounter(num)
    const t0 = Date.now()

    updateCell(cellId, {
      state:           CELL_STATE.DSL_GENERATING,
      error:           null,
      executionNumber: num,
      dslCells:        null,
      dslEditableCode: null,
      dslExecOutput:   null,
      dslExecError:    null,
      dslGenerateTime: null,
      dslExecTime:     null,
    })

    try {
      const res = await fetch(`${API}/dsl/run_text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: cell.dslSource }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'DSL run failed' }))
        throw new Error(err.detail || 'DSL run failed')
      }
      const data = await res.json()
      const generateTime = ((Date.now() - t0) / 1000).toFixed(1)

      // Build a single editable code string from all verified nodes
      // separated by clear node headers so user knows which section is which
      const editableCode = data.cells
        .map(node => {
          const header = `# ── node: ${node.node_name} ──────────────────────────\n# intent: ${node.intent}\n`
          const status = node.verified ? '' : '# ⚠️  UNVERIFIED\n'
          return header + status + (node.code || '# (no code generated)')
        })
        .join('\n\n')

      const finalState = data.success ? CELL_STATE.DSL_CODE_READY : CELL_STATE.DSL_PARTIAL
      updateCell(cellId, {
        state:           finalState,
        dslCells:        data.cells,
        dslEditableCode: editableCode,
        dslGenerateTime: generateTime,
      })

      if (data.success) {
        toast.success(`Code generated — review and edit, then press Run to execute.`, { duration: 4000 })
      } else {
        const failed = data.cells.filter(c => !c.verified).length
        toast.warning(`${failed} node${failed !== 1 ? 's' : ''} failed verification — review before running.`)
      }
    } catch (err) {
      updateCell(cellId, { state: CELL_STATE.DSL_ERROR, error: err.message })
      toast.error(`DSL error: ${err.message}`)
    }
  }, [cells, executionCounter, updateCell])

  // ── DSL-mode: Stage 2 — execute the (possibly edited) code ────────────────
  const dslExecuteCell = useCallback(async (cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell || !cell.dslEditableCode?.trim()) return

    const t0 = Date.now()
    updateCell(cellId, {
      state:         CELL_STATE.DSL_EXECUTING,
      dslExecOutput: null,
      dslExecError:  null,
      error:         null,
    })

    try {
      const res = await fetch(`${API}/dsl/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cell.dslEditableCode }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Execution failed' }))
        throw new Error(err.detail || 'Execution failed')
      }
      const data = await res.json()
      const execTime = ((Date.now() - t0) / 1000).toFixed(1)

      updateCell(cellId, {
        state:         CELL_STATE.DSL_COMPLETE,
        dslExecOutput: data.output,
        dslExecError:  data.error,
        dslExecTime:   execTime,
      })

      if (data.error) {
        toast.warning('Code ran with errors — check the output.')
      } else {
        toast.success('Code executed successfully!')
      }
    } catch (err) {
      updateCell(cellId, { state: CELL_STATE.DSL_ERROR, error: err.message })
      toast.error(`Execution failed: ${err.message}`)
    }
  }, [cells, updateCell])

  // ── DSL master run — routes between Stage 1 and Stage 2 ───────────────────
  const runDSLCell = useCallback((cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell) return
    if (
      cell.state === CELL_STATE.IDLE ||
      cell.state === CELL_STATE.DSL_ERROR ||
      cell.state === CELL_STATE.DSL_COMPLETE
    ) {
      dslGenerateCell(cellId)
    } else if (
      cell.state === CELL_STATE.DSL_CODE_READY ||
      cell.state === CELL_STATE.DSL_PARTIAL
    ) {
      dslExecuteCell(cellId)
    }
  }, [cells, dslGenerateCell, dslExecuteCell])

  // ── Master run dispatcher ──────────────────────────────────────────────────
  const runCell = useCallback((cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell) return
    cell.mode === 'dsl' ? runDSLCell(cellId) : runTextCell(cellId)
  }, [cells, runDSLCell, runTextCell])

  // ── Toggle mode ────────────────────────────────────────────────────────────
  const toggleCellMode = useCallback((cellId) => {
    const cell = cells.find(c => c.id === cellId)
    if (!cell) return
    const newMode = cell.mode === 'text' ? 'dsl' : 'text'
    updateCell(cellId, {
      mode:            newMode,
      state:           CELL_STATE.IDLE,
      error:           null,
      dslCells:        null,
      dslEditableCode: null,
      dslExecOutput:   null,
      dslExecError:    null,
      translatedText:  null,
      balloonCount:    0,
      balloonImages:   [],
    })
    toast(`Switched to ${newMode === 'dsl' ? 'DSL' : 'Text'} mode.`, {
      icon: newMode === 'dsl' ? '◈' : '≡',
      duration: 1500,
    })
  }, [cells, updateCell])

  // ── Clear ──────────────────────────────────────────────────────────────────
  const clearCell = useCallback((cellId) => {
    updateCell(cellId, {
      state:           CELL_STATE.IDLE,
      translatedText:  null,
      balloonCount:    0,
      balloonImages:   [],
      error:           null,
      executionNumber: null,
      translateTime:   null,
      interpretTime:   null,
      dslCells:        null,
      dslEditableCode: null,
      dslExecOutput:   null,
      dslExecError:    null,
      dslGenerateTime: null,
      dslExecTime:     null,
    })
    toast('Cell cleared.', { icon: '🧹', duration: 1500 })
  }, [updateCell])

  // ── Add / delete ───────────────────────────────────────────────────────────
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

  const setCellInput          = useCallback((id, v) => updateCell(id, { input: v }), [updateCell])
  const setDSLSource          = useCallback((id, v) => updateCell(id, { dslSource: v }), [updateCell])
  const setDSLEditableCode    = useCallback((id, v) => updateCell(id, { dslEditableCode: v }), [updateCell])
  const setTranslatedText     = useCallback((id, v) => updateCell(id, { translatedText: v }), [updateCell])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); setShowCommandBar(p => !p); return }
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
              <Button variant="jupyter-outline" size="sm" onClick={() => setShowCommandBar(true)} className="gap-1.5">
                <Keyboard className="h-3.5 w-3.5" />
                Shortcuts
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-muted/50 border-t">
            <Button variant="jupyter-ghost" size="xs">Cell</Button>
            <Button variant="jupyter-ghost" size="xs">Kernel</Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <span className="text-xs text-muted-foreground font-mono">
              Text: Translate → Interpret · DSL: Generate → Edit → Execute
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
                  onDSLGenerate={() => dslGenerateCell(cell.id)}
                  onDSLExecute={() => dslExecuteCell(cell.id)}
                  onClear={() => clearCell(cell.id)}
                  onDelete={() => deleteCell(cell.id)}
                  onToggleMode={() => toggleCellMode(cell.id)}
                  onInputChange={(v) => setCellInput(cell.id, v)}
                  onDSLSourceChange={(v) => setDSLSource(cell.id, v)}
                  onDSLEditableCodeChange={(v) => setDSLEditableCode(cell.id, v)}
                  onTranslatedTextChange={(v) => setTranslatedText(cell.id, v)}
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
            LLM Notebook · FastAPI + vLLM + React · Text Mode + DSL Mode
          </footer>
        </main>

        <CommandBar open={showCommandBar} onOpenChange={setShowCommandBar} />
        <Toaster position="bottom-right" richColors />
      </div>
    </TooltipProvider>
  )
}