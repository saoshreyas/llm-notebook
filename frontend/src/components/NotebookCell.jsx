import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react'
import {
  Play, RotateCcw, Trash2, Loader2, AlertCircle, CheckCircle2, Circle,
  Pencil, Code2, ToggleLeft, ToggleRight, Terminal,
} from 'lucide-react'

import { CELL_STATE } from '../App'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { Separator } from './ui/separator'

// ── State config ──────────────────────────────────────────────────────────────
const STATE_CONFIG = {
  // text-mode (unchanged)
  idle: {
    icon: Circle, label: 'Not executed', badgeVariant: 'idle',
    borderColor: 'transparent', spinning: false, progress: 0,
  },
  translating: {
    icon: Loader2, label: 'NL → DSL...', badgeVariant: 'translating',
    borderColor: '#2196F3', spinning: true, progress: 33,
  },
  translated: {
    icon: CheckCircle2, label: 'DSL ready — run interpreter (Shift+Enter)',
    badgeVariant: 'translated', borderColor: '#F0AD4E', spinning: false, progress: 50,
  },
  interpreting: {
    icon: Loader2, label: 'Interpreter running...', badgeVariant: 'interpreting',
    borderColor: '#9C27B0', spinning: true, progress: 75,
  },
  complete: {
    icon: CheckCircle2, label: 'Complete', badgeVariant: 'complete',
    borderColor: '#4CAF50', spinning: false, progress: 100,
  },
  error: {
    icon: AlertCircle, label: 'Error', badgeVariant: 'error',
    borderColor: '#D9534F', spinning: false, progress: 0,
  },
  // DSL-mode
  dsl_generating: {
    icon: Loader2, label: 'Interpreter: per-node generate / verify / run', badgeVariant: 'interpreting',
    borderColor: '#9C27B0', spinning: true, progress: 40,
  },
  dsl_code_ready: {
    icon: CheckCircle2, label: 'Ready to run — execution output only',
    badgeVariant: 'translated', borderColor: '#F0AD4E', spinning: false, progress: 60,
  },
  dsl_partial: {
    icon: AlertCircle, label: 'Partial — some nodes failed verification',
    badgeVariant: 'translated', borderColor: '#F0AD4E', spinning: false, progress: 60,
  },
  dsl_executing: {
    icon: Loader2, label: 'Executing...', badgeVariant: 'interpreting',
    borderColor: '#9C27B0', spinning: true, progress: 80,
  },
  dsl_complete: {
    icon: CheckCircle2, label: 'Complete', badgeVariant: 'complete',
    borderColor: '#4CAF50', spinning: false, progress: 100,
  },
  dsl_error: {
    icon: AlertCircle, label: 'Error', badgeVariant: 'error',
    borderColor: '#D9534F', spinning: false, progress: 0,
  },
}

const PROGRESS_COLORS = {
  translating:    'bg-blue-500',
  translated:     'bg-yellow-500',
  interpreting:   'bg-purple-500',
  complete:       'bg-green-500',
  error:          'bg-red-500',
  dsl_generating: 'bg-purple-500',
  dsl_code_ready: 'bg-yellow-500',
  dsl_partial:    'bg-yellow-500',
  dsl_executing:  'bg-purple-500',
  dsl_complete:   'bg-green-500',
  dsl_error:      'bg-red-500',
}

const DSL_PLACEHOLDER = `pipeline my_pipeline:
  description: "what this pipeline does"

  config:
    retries: 3

  global:
    constraint error: never use subprocess or eval
    constraint error: only use stdlib, pandas, numpy, or requests

  node step_one:
    intent: "describe what this node should do in plain English"
    output: "str"
    constraint error: handle errors gracefully

  node step_two:
    intent: "describe what this node should do"
    input: step_one
    output: "dict"`

const NotebookCell = forwardRef(function NotebookCell(
  {
    cell, isFocused, onFocus,
    onRun, onTranslate, onInterpret,
    onDSLGenerate, onDSLExecute,
    onClear, onDelete, onToggleMode,
    onInputChange, onDSLSourceChange,
    canDelete,
  },
  ref,
) {
  const textareaRef   = useRef(null)
  const dslRef        = useRef(null)
  const translatedRef = useRef(null)
  useImperativeHandle(ref, () => ({
    focus: () => cell.mode === 'dsl' ? dslRef.current?.focus() : textareaRef.current?.focus(),
  }))

  const cfg       = STATE_CONFIG[cell.state] || STATE_CONFIG.idle
  const StateIcon = cfg.icon
  const isDSL     = cell.mode === 'dsl'

  const showDSLPipeline = isDSL || [
    CELL_STATE.DSL_GENERATING,
    CELL_STATE.DSL_CODE_READY,
    CELL_STATE.DSL_PARTIAL,
    CELL_STATE.DSL_EXECUTING,
    CELL_STATE.DSL_COMPLETE,
    CELL_STATE.DSL_ERROR,
  ].includes(cell.state)

  const isRunning = [
    CELL_STATE.TRANSLATING,
    CELL_STATE.DSL_GENERATING,
    CELL_STATE.DSL_EXECUTING,
  ].includes(cell.state)

  const isTranslating  = cell.state === CELL_STATE.TRANSLATING
  const isDSLGenerating = cell.state === CELL_STATE.DSL_GENERATING
  const isDSLExecuting  = cell.state === CELL_STATE.DSL_EXECUTING
  const isDSLCodeReady  = cell.state === CELL_STATE.DSL_CODE_READY || cell.state === CELL_STATE.DSL_PARTIAL
  const showProgress    = cell.state !== CELL_STATE.IDLE

  // Auto-resize textareas
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.max(80, ta.scrollHeight) + 'px' }
  }, [cell.input])

  useEffect(() => {
    const ta = dslRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.max(180, ta.scrollHeight) + 'px' }
  }, [cell.dslSource])

  useEffect(() => {
    const ta = translatedRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.max(120, ta.scrollHeight) + 'px' }
  }, [cell.dslSource])

  const leftBorderColor =
    cell.state === CELL_STATE.TRANSLATED    ? '#F0AD4E' :
    cell.state === CELL_STATE.DSL_CODE_READY? '#F0AD4E' :
    cell.state === CELL_STATE.DSL_PARTIAL   ? '#F0AD4E' :
    cell.state === CELL_STATE.COMPLETE      ? '#4CAF50' :
    cell.state === CELL_STATE.DSL_COMPLETE  ? '#4CAF50' :
    cell.state === CELL_STATE.ERROR         ? '#D9534F' :
    cell.state === CELL_STATE.DSL_ERROR     ? '#D9534F' :
    'transparent'

  const handleKeyDown = (e) => {
    if (e.shiftKey && e.key === 'Enter') { e.preventDefault(); onRun() }
    if (e.ctrlKey  && e.key === 'Enter') { e.preventDefault(); onRun() }
  }

  return (
    <div
      onClick={onFocus}
      className={`relative border rounded-md mb-0 transition-all duration-150 overflow-hidden ${
        isFocused ? 'cell-focused' : 'border-border'
      }`}
      style={{ borderLeft: `4px solid ${leftBorderColor}` }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-muted-foreground select-none min-w-[70px]">
            In [{cell.executionNumber || ' '}]:
          </span>
          <Badge variant={cfg.badgeVariant} className="gap-1">
            <StateIcon className={`h-3 w-3 ${cfg.spinning ? 'animate-spin' : ''}`} />
            {cfg.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* Mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="jupyter-ghost" size="xs"
                onClick={(e) => { e.stopPropagation(); onToggleMode() }}
                disabled={isRunning}
                className={`gap-1 font-mono text-[11px] ${isDSL ? 'text-purple-600 hover:text-purple-700' : 'text-muted-foreground'}`}
              >
                {isDSL
                  ? <><ToggleRight className="h-3 w-3" /> DSL</>
                  : <><ToggleLeft  className="h-3 w-3" /> Text</>
                }
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDSL ? 'Switch to Text mode' : 'Switch to DSL mode'}</TooltipContent>
          </Tooltip>

          {/* Text-mode: Translate button */}
          {!isDSL && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="translate" size="xs"
                  onClick={(e) => { e.stopPropagation(); onTranslate() }}
                  disabled={isRunning || !cell.input.trim()}
                  className="gap-1"
                >
                  {isTranslating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  {isTranslating ? 'NL→DSL...' : 'NL → DSL'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Step 1: natural language → NotebookDSL (retries on parse errors)</TooltipContent>
            </Tooltip>
          )}

          {/* DSL-mode: Generate button (Stage 1) */}
          {isDSL && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="translate" size="xs"
                  onClick={(e) => { e.stopPropagation(); onDSLGenerate() }}
                  disabled={isRunning || !cell.dslSource.trim()}
                  className="gap-1"
                >
                  {isDSLGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Code2 className="h-3 w-3" />}
                  {isDSLGenerating ? 'Working...' : 'Run interpreter'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Parse DSL, then per node: generate Python, verify, execute (Shift+Enter)</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="jupyter-ghost" size="icon-sm"
                onClick={(e) => { e.stopPropagation(); onClear() }}
                disabled={cell.state === CELL_STATE.IDLE}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear output and restart</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="jupyter-ghost" size="icon-sm"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                disabled={!canDelete}
                className="hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{canDelete ? 'Delete cell (Alt+D)' : 'Cannot delete the last cell'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Progress bar */}
      {showProgress && (
        <Progress
          value={cfg.progress}
          className="h-0.5 rounded-none"
          indicatorClassName={PROGRESS_COLORS[cell.state] || 'bg-primary'}
        />
      )}

      {/* ── Input textarea ────────────────────────────────────────────────── */}
      {isDSL ? (
        <div className="relative">
          <div className="absolute top-2 right-3 text-[10px] font-mono text-purple-400/50 pointer-events-none select-none">.ndsl</div>
          <textarea
            ref={dslRef}
            value={cell.dslSource}
            onChange={(e) => onDSLSourceChange(e.target.value)}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            placeholder={DSL_PLACEHOLDER}
            className="w-full bg-background text-foreground font-mono text-sm leading-relaxed resize-none outline-none p-3 placeholder:text-muted-foreground/40"
            style={{ minHeight: '180px' }}
            spellCheck={false}
          />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={cell.input}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={onFocus}
          placeholder={'Enter text here... Try: "I love BALLOONS! Red Balloon, blue BALLOON."\n\nShift+Enter to run  •  Alt+A to add cell  •  Ctrl+/ for shortcuts'}
          className="w-full bg-background text-foreground font-mono text-sm leading-relaxed resize-none outline-none p-3 placeholder:text-muted-foreground/60"
          style={{ minHeight: '80px' }}
          spellCheck={false}
        />
      )}

      {/* ── Pipeline output (DSL mode or Text mode after NL→DSL / interpreter) ─ */}
      {showDSLPipeline && (
        <>
          {/* Stage 1 spinner */}
          {isDSLGenerating && (
            <>
              <Separator />
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                <span className="font-mono text-xs text-purple-500">
                  Interpreter: generate, verify, and execute each node...
                </span>
              </div>
            </>
          )}

          {/* DSL error */}
          {cell.state === CELL_STATE.DSL_ERROR && cell.error && (
            <>
              <Separator />
              <div className="p-3">
                <Alert variant="error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs">DSL Error</AlertTitle>
                  <AlertDescription className="text-xs font-mono mt-1">{cell.error}</AlertDescription>
                </Alert>
              </div>
            </>
          )}

          {/* ── After interpreter: merged Python in state only; Run shows execution output ─ */}
          {cell.dslEditableCode !== null && !isDSLGenerating && (
            <>
              <Separator />
              <div className="px-4 py-3 bg-muted/20">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                    Out [{cell.executionNumber || ' '}]:
                  </span>
                  <Badge variant="stage1" className="text-[10px] gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Interpreter finished
                  </Badge>
                  {cell.dslGenerateTime && (
                    <span className="text-[10px] text-muted-foreground font-mono">{cell.dslGenerateTime}s</span>
                  )}
                  {cell.dslCells && (
                    <div className="flex flex-wrap gap-1">
                      {cell.dslCells.map((n, i) => (
                        <span
                          key={i}
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${
                            n.verified
                              ? 'bg-green-100 text-green-700 border-green-300'
                              : 'bg-red-100 text-red-700 border-red-300'
                          }`}
                        >
                          {n.verified ? '✓' : '✗'} {n.node_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-3 pb-1">
                  {isDSLCodeReady && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="interpret" size="sm"
                            onClick={(e) => { e.stopPropagation(); onDSLExecute() }}
                            className="gap-1.5 w-fit"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                            Run
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Execute merged Python and show stdout / result only (Shift+Enter)
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-[11px] text-muted-foreground">
                        Generated Python is not shown; press Run or{' '}
                        <kbd className="px-1 py-0.5 bg-muted border rounded text-[10px] font-mono">Shift+Enter</kbd>
                        {' '}to see output.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Stage 2 executing spinner */}
          {isDSLExecuting && (
            <>
              <Separator />
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                <span className="font-mono text-xs text-purple-500">Running code...</span>
              </div>
            </>
          )}

          {/* ── Stage 3: Execution output ───────────────────────────────── */}
          {cell.state === CELL_STATE.DSL_COMPLETE && (
            <>
              <Separator />
              <div className={`px-4 py-3 ${cell.dslExecError ? 'bg-red-50/50' : 'bg-green-50/50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                    Out [{cell.executionNumber || ' '}]:
                  </span>
                  <Badge variant={cell.dslExecError ? 'error' : 'stage2'} className="text-[10px] gap-1">
                    <Terminal className="h-2.5 w-2.5" />
                    {cell.dslExecError ? 'Execution Error' : 'Execution output'}
                  </Badge>
                  {cell.dslExecTime && (
                    <span className="text-[10px] text-muted-foreground font-mono">{cell.dslExecTime}s</span>
                  )}
                </div>

                <div className="px-3 pb-1">
                  {cell.dslExecError ? (
                    <Alert variant="error" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="text-xs">Runtime Error</AlertTitle>
                      <AlertDescription>
                        <pre className="text-xs font-mono mt-1 whitespace-pre-wrap">{cell.dslExecError}</pre>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="success" className="py-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        {cell.dslExecOutput ? (
                          <pre className="text-xs font-mono mt-1 whitespace-pre-wrap leading-relaxed">
                            {cell.dslExecOutput}
                          </pre>
                        ) : (
                          <span className="text-xs font-mono">Code executed successfully (no output).</span>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Text-mode: Stage 1 DSL preview (flat layout, no nested indent) ─── */}
      {!isDSL && (cell.state !== CELL_STATE.IDLE || cell.error) && (
        <>
          <Separator />

          {isTranslating && (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="font-mono text-xs text-blue-500">NL → DSL (invalid programs are sent back to the model to fix)...</span>
            </div>
          )}

          {cell.error && (
            <div className="p-3">
              <Alert variant="error">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs">Error</AlertTitle>
                <AlertDescription className="text-xs font-mono mt-1">{cell.error}</AlertDescription>
              </Alert>
            </div>
          )}

          {cell.state === CELL_STATE.TRANSLATED && cell.dslSource != null && !isTranslating && (
            <div className="px-4 py-3 bg-muted/20">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                  Out [{cell.executionNumber || ' '}]:
                </span>
                  <Badge variant="stage1" className="text-[10px]">NotebookDSL (.ndsl)</Badge>
                {cell.translateTime != null && (
                  <span className="text-[10px] text-muted-foreground font-mono">{cell.translateTime}s</span>
                )}
                <Badge variant="outline" className="text-[10px] gap-1 ml-auto text-muted-foreground">
                  <Pencil className="h-2.5 w-2.5" />
                  Editable
                </Badge>
              </div>
              <div className="px-3">
                <div className="relative mb-2">
                  <div className="absolute top-2 right-2 text-[10px] font-mono text-muted-foreground/60 pointer-events-none">.ndsl</div>
                  <textarea
                    ref={translatedRef}
                    value={cell.dslSource}
                    onChange={(e) => onDSLSourceChange(e.target.value)}
                    className="w-full bg-background border border-yellow-300 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-300 rounded-md p-3 font-mono text-sm leading-relaxed resize-none outline-none cursor-text"
                    style={{ minHeight: '120px' }}
                    spellCheck={false}
                  />
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="interpret" size="sm" onClick={(e) => { e.stopPropagation(); onInterpret() }} className="gap-1.5">
                        <Play className="h-3.5 w-3.5" />
                        Run interpreter
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Interpreter: parse DSL → per-node generate / verify / execute (Shift+Enter)</TooltipContent>
                  </Tooltip>
                  <span className="text-[11px] text-muted-foreground">
                    Edit the DSL if needed, then run the interpreter or press{' '}
                    <kbd className="px-1 py-0.5 bg-muted border rounded text-[10px] font-mono">Shift+Enter</kbd>
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
})

export default NotebookCell 