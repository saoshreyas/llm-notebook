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
    icon: Loader2, label: 'Translating...', badgeVariant: 'translating',
    borderColor: '#2196F3', spinning: true, progress: 33,
  },
  translated: {
    icon: CheckCircle2, label: 'Translated — edit below, then interpret',
    badgeVariant: 'translated', borderColor: '#F0AD4E', spinning: false, progress: 50,
  },
  interpreting: {
    icon: Loader2, label: 'Interpreting...', badgeVariant: 'interpreting',
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
    icon: Loader2, label: 'Generating code...', badgeVariant: 'interpreting',
    borderColor: '#9C27B0', spinning: true, progress: 40,
  },
  dsl_code_ready: {
    icon: CheckCircle2, label: 'Code ready — edit if needed, then run',
    badgeVariant: 'translated', borderColor: '#F0AD4E', spinning: false, progress: 60,
  },
  dsl_partial: {
    icon: AlertCircle, label: 'Partial — some nodes failed, review before running',
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
    onDSLEditableCodeChange, onTranslatedTextChange,
    canDelete,
  },
  ref,
) {
  const textareaRef   = useRef(null)
  const dslRef        = useRef(null)
  const translatedRef = useRef(null)
  const codeRef       = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => cell.mode === 'dsl' ? dslRef.current?.focus() : textareaRef.current?.focus(),
  }))

  const cfg       = STATE_CONFIG[cell.state] || STATE_CONFIG.idle
  const StateIcon = cfg.icon
  const isDSL     = cell.mode === 'dsl'

  const isRunning = [
    CELL_STATE.TRANSLATING, CELL_STATE.INTERPRETING,
    CELL_STATE.DSL_GENERATING, CELL_STATE.DSL_EXECUTING,
  ].includes(cell.state)

  const isTranslating  = cell.state === CELL_STATE.TRANSLATING
  const isInterpreting = cell.state === CELL_STATE.INTERPRETING
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
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.max(48, ta.scrollHeight) + 'px' }
  }, [cell.translatedText])

  useEffect(() => {
    const ta = codeRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.max(120, ta.scrollHeight) + 'px' }
  }, [cell.dslEditableCode])

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
                  {isTranslating ? 'Translating...' : 'Translate'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stage 1: Translate to lowercase via LLM (Shift+Enter)</TooltipContent>
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
                  {isDSLGenerating ? 'Generating...' : 'Generate Code'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stage 1: Generate + verify code from DSL (Shift+Enter)</TooltipContent>
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

      {/* ── DSL Output ────────────────────────────────────────────────────── */}
      {isDSL && (
        <>
          {/* Stage 1 spinner */}
          {isDSLGenerating && (
            <>
              <Separator />
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                <span className="font-mono text-xs text-purple-500">
                  Generating & verifying code for each node...
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

          {/* ── Stage 2: Editable generated code ───────────────────────── */}
          {cell.dslEditableCode !== null && !isDSLGenerating && (
            <>
              <Separator />
              <div className="px-4 py-3 bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                    Out [{cell.executionNumber || ' '}]:
                  </span>
                  <Badge variant="stage1" className="text-[10px] gap-1">
                    <Code2 className="h-2.5 w-2.5" />
                    Stage 1: Generated Code
                  </Badge>
                  {cell.dslGenerateTime && (
                    <span className="text-[10px] text-muted-foreground font-mono">{cell.dslGenerateTime}s</span>
                  )}
                  {isDSLCodeReady && (
                    <Badge variant="outline" className="text-[10px] gap-1 ml-auto text-muted-foreground">
                      <Pencil className="h-2.5 w-2.5" />
                      Editable
                    </Badge>
                  )}
                  {/* Node summary badges */}
                  {cell.dslCells && (
                    <div className="flex gap-1 ml-auto">
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

                <div className="ml-[82px]">
                  <textarea
                    ref={codeRef}
                    value={cell.dslEditableCode}
                    onChange={(e) => onDSLEditableCodeChange(e.target.value)}
                    readOnly={!isDSLCodeReady}
                    className={`w-full bg-gray-950 text-gray-100 border rounded-md p-3 font-mono text-xs leading-relaxed resize-none outline-none transition-colors ${
                      isDSLCodeReady
                        ? 'border-yellow-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 cursor-text'
                        : 'border-border cursor-default'
                    }`}
                    style={{ minHeight: '120px' }}
                    spellCheck={false}
                  />

                  {/* Execute button — appears after code is ready */}
                  {isDSLCodeReady && (
                    <div className="flex items-center gap-3 mt-2.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="interpret" size="sm"
                            onClick={(e) => { e.stopPropagation(); onDSLExecute() }}
                            className="gap-1.5"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                            Run Code
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Stage 2: Execute the generated code (Shift+Enter)
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-[11px] text-muted-foreground">
                        Edit the code above if needed, then click Run Code or press{' '}
                        <kbd className="px-1 py-0.5 bg-muted border rounded text-[10px] font-mono">Shift+Enter</kbd>
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
                    {cell.dslExecError ? 'Execution Error' : 'Stage 2: Output'}
                  </Badge>
                  {cell.dslExecTime && (
                    <span className="text-[10px] text-muted-foreground font-mono">{cell.dslExecTime}s</span>
                  )}
                </div>

                <div className="ml-[82px]">
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

      {/* ── Text-mode output (completely unchanged) ───────────────────────── */}
      {!isDSL && (cell.state !== CELL_STATE.IDLE || cell.error) && (
        <>
          <Separator />

          {isTranslating && (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="font-mono text-xs text-blue-500">Translating with LLM...</span>
            </div>
          )}

          {cell.error && (
            <div className="p-3">
              <Alert variant="error">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs">Execution Error</AlertTitle>
                <AlertDescription className="text-xs font-mono mt-1">{cell.error}</AlertDescription>
              </Alert>
            </div>
          )}

          {cell.translatedText !== null && !isTranslating && (
            <div className="px-4 py-3 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                  Out [{cell.executionNumber || ' '}]:
                </span>
                <Badge variant="stage1" className="text-[10px]">Stage 1: Translation</Badge>
                {cell.translateTime != null && (
                  <span className="text-[10px] text-muted-foreground font-mono">{cell.translateTime}s</span>
                )}
                {cell.state === CELL_STATE.TRANSLATED && (
                  <Badge variant="outline" className="text-[10px] gap-1 ml-auto text-muted-foreground">
                    <Pencil className="h-2.5 w-2.5" />
                    Editable
                  </Badge>
                )}
              </div>
              <div className="ml-[82px]">
                <textarea
                  ref={translatedRef}
                  value={cell.translatedText}
                  onChange={(e) => onTranslatedTextChange(e.target.value)}
                  readOnly={cell.state !== CELL_STATE.TRANSLATED}
                  className={`w-full bg-background border rounded-md p-3 font-mono text-sm leading-relaxed resize-none outline-none transition-colors ${
                    cell.state === CELL_STATE.TRANSLATED
                      ? 'border-yellow-300 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-300 cursor-text'
                      : 'border-border cursor-default'
                  }`}
                  style={{ minHeight: '48px' }}
                  spellCheck={false}
                />
                {cell.state === CELL_STATE.TRANSLATED && (
                  <div className="flex items-center gap-3 mt-2.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="interpret" size="sm" onClick={(e) => { e.stopPropagation(); onInterpret() }} className="gap-1.5">
                          <Play className="h-3.5 w-3.5" />
                          Interpret
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Stage 2: Count &ldquo;balloon&rdquo; and generate images (Shift+Enter)</TooltipContent>
                    </Tooltip>
                    <span className="text-[11px] text-muted-foreground">
                      Edit the text above if needed, then click Interpret or press{' '}
                      <kbd className="px-1 py-0.5 bg-muted border rounded text-[10px] font-mono">Shift+Enter</kbd>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {isInterpreting && (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              <span className="font-mono text-xs text-purple-500">Counting balloons & generating images...</span>
            </div>
          )}

          {cell.state === CELL_STATE.COMPLETE && (
            <>
              <Separator />
              <div className="px-4 py-3 bg-green-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                    Out [{cell.executionNumber || ' '}]:
                  </span>
                  <Badge variant="stage2" className="text-[10px]">Stage 2: Interpretation</Badge>
                  {cell.interpretTime != null && (
                    <span className="text-[10px] text-muted-foreground font-mono">{cell.interpretTime}s</span>
                  )}
                </div>
                <div className="ml-[82px]">
                  {cell.balloonCount > 0 ? (
                    <div>
                      <Alert variant="success" className="mb-3 py-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Found <strong>{cell.balloonCount}</strong> balloon{cell.balloonCount !== 1 ? 's' : ''} in the text!
                        </AlertDescription>
                      </Alert>
                      <div className="flex flex-wrap gap-3">
                        {cell.balloonImages.map((uri, i) => (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <div
                                className="animate-float-in hover:scale-110 hover:-translate-y-1 transition-transform duration-200 cursor-pointer"
                                style={{ animationDelay: `${i * 80}ms` }}
                              >
                                <img src={uri} alt={`Balloon ${i + 1}`} className="w-[80px] h-auto drop-shadow-md" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Balloon {i + 1}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Alert variant="info" className="py-2">
                      <AlertDescription className="text-sm font-mono">No balloons detected in the text.</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
})

export default NotebookCell 