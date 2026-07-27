import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react'
import {
  Play, RotateCcw, Trash2, Loader2, AlertCircle, CheckCircle2, Circle,
  Pencil, ToggleLeft, ToggleRight,
} from 'lucide-react'

import { CELL_STATE } from '../App'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { Separator } from './ui/separator'

const STATE_CONFIG = {
  idle: {
    icon: Circle, label: 'Not executed', badgeVariant: 'idle',
    spinning: false, progress: 0,
  },
  translating: {
    icon: Loader2, label: 'NL → DSL...', badgeVariant: 'translating',
    spinning: true, progress: 33,
  },
  translated: {
    icon: CheckCircle2, label: 'DSL ready — run to interpret',
    badgeVariant: 'translated', spinning: false, progress: 50,
  },
  interpreting: {
    icon: Loader2, label: 'Interpreting workflow...', badgeVariant: 'interpreting',
    spinning: true, progress: 75,
  },
  complete: {
    icon: CheckCircle2, label: 'Complete', badgeVariant: 'complete',
    spinning: false, progress: 100,
  },
  partial: {
    icon: AlertCircle, label: 'Partial — some nodes failed',
    badgeVariant: 'translated', spinning: false, progress: 80,
  },
  error: {
    icon: AlertCircle, label: 'Error', badgeVariant: 'error',
    spinning: false, progress: 0,
  },
}

const PROGRESS_COLORS = {
  translating: 'bg-blue-500',
  translated: 'bg-yellow-500',
  interpreting: 'bg-purple-500',
  complete: 'bg-green-500',
  partial: 'bg-yellow-500',
  error: 'bg-red-500',
}

const DSL_PLACEHOLDER = `workflow research_agent:
  description: "plan then answer"
  config:
    retries: 2

  node plan:
    kind: prompt
    prompt: "Task: {{task}}. Write a 3-step plan."
    output: plan

  node answer:
    kind: prompt
    prompt: |
      Using this plan, answer the task.
      Plan: {{plan}}
      Task: {{task}}
    input: plan
    output: answer

  node format:
    kind: code
    input: answer
    code: |
      result = {"answer": answer, "length": len(answer)}
    output: result`

const NotebookCell = forwardRef(function NotebookCell(
  {
    cell, isFocused, onFocus,
    onRun, onTranslate, onInterpret,
    onClear, onDelete, onToggleMode,
    onInputChange, onDSLSourceChange, onDSLBlur,
    canDelete,
  },
  ref,
) {
  const textareaRef = useRef(null)
  const dslRef = useRef(null)
  const translatedRef = useRef(null)
  useImperativeHandle(ref, () => ({
    focus: () => (cell.mode === 'dsl' ? dslRef.current?.focus() : textareaRef.current?.focus()),
  }))

  const cfg = STATE_CONFIG[cell.state] || STATE_CONFIG.idle
  const StateIcon = cfg.icon
  const isDSL = cell.mode === 'dsl'
  const isRunning = [CELL_STATE.TRANSLATING, CELL_STATE.INTERPRETING].includes(cell.state)
  const showProgress = cell.state !== CELL_STATE.IDLE

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.max(80, ta.scrollHeight)}px` }
  }, [cell.input])

  useEffect(() => {
    const ta = dslRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.max(180, ta.scrollHeight)}px` }
  }, [cell.dslSource])

  useEffect(() => {
    const ta = translatedRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.max(120, ta.scrollHeight)}px` }
  }, [cell.dslSource])

  const leftBorderColor =
    cell.state === CELL_STATE.TRANSLATED ? '#F0AD4E' :
    cell.state === CELL_STATE.PARTIAL ? '#F0AD4E' :
    cell.state === CELL_STATE.COMPLETE ? '#4CAF50' :
    cell.state === CELL_STATE.ERROR ? '#D9534F' :
    'transparent'

  const handleKeyDown = (e) => {
    if (e.shiftKey && e.key === 'Enter') { e.preventDefault(); onRun() }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); onRun() }
  }

  const showResults = cell.nodes && [CELL_STATE.COMPLETE, CELL_STATE.PARTIAL, CELL_STATE.INTERPRETING].includes(cell.state)
    || (cell.nodes && cell.state === CELL_STATE.ERROR)

  return (
    <div
      onClick={onFocus}
      className={`relative border rounded-md mb-0 transition-all duration-150 overflow-hidden ${
        isFocused ? 'cell-focused' : 'border-border'
      }`}
      style={{ borderLeft: `4px solid ${leftBorderColor}` }}
    >
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
                  : <><ToggleLeft className="h-3 w-3" /> Text</>}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDSL ? 'Switch to Text mode' : 'Switch to DSL mode'}</TooltipContent>
          </Tooltip>

          {!isDSL && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="translate" size="xs"
                  onClick={(e) => { e.stopPropagation(); onTranslate() }}
                  disabled={isRunning || !cell.input.trim()}
                  className="gap-1"
                >
                  {cell.state === CELL_STATE.TRANSLATING
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Play className="h-3 w-3" />}
                  {cell.state === CELL_STATE.TRANSLATING ? 'NL→DSL...' : 'NL → DSL'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Step 1: natural language → Workflow DSL</TooltipContent>
            </Tooltip>
          )}

          {(isDSL || cell.state === CELL_STATE.TRANSLATED) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="interpret" size="xs"
                  onClick={(e) => { e.stopPropagation(); onInterpret() }}
                  disabled={isRunning || !cell.dslSource.trim()}
                  className="gap-1"
                >
                  {cell.state === CELL_STATE.INTERPRETING
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Play className="h-3 w-3" />}
                  {cell.state === CELL_STATE.INTERPRETING ? 'Interpreting...' : 'Interpret'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Semantic interpret: prompt nodes → LLM, code nodes → Python</TooltipContent>
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

      {showProgress && (
        <Progress
          value={cfg.progress}
          className="h-0.5 rounded-none"
          indicatorClassName={PROGRESS_COLORS[cell.state] || 'bg-primary'}
        />
      )}

      {isDSL ? (
        <div className="relative">
          <div className="absolute top-2 right-3 text-[10px] font-mono text-purple-400/50 pointer-events-none select-none">.wfl</div>
          <textarea
            ref={dslRef}
            value={cell.dslSource}
            onChange={(e) => onDSLSourceChange(e.target.value)}
            onBlur={onDSLBlur}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            placeholder={DSL_PLACEHOLDER}
            className="w-full bg-background text-foreground font-mono text-sm leading-relaxed resize-none outline-none p-3 placeholder:text-muted-foreground/40"
            style={{ minHeight: '180px' }}
            spellCheck={false}
          />
          {cell.syntaxError && (
            <div className="px-3 pb-2">
              <Alert variant="error" className="py-2">
                <AlertCircle className="h-3.5 w-3.5" />
                <AlertTitle className="text-[11px]">Syntax</AlertTitle>
                <AlertDescription className="text-[11px] font-mono">{cell.syntaxError}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={cell.input}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={onFocus}
          placeholder={'Describe an agentic workflow in plain English…\n\nShift+Enter: NL→DSL, then again to interpret  •  Alt+A add cell  •  Ctrl+/ help'}
          className="w-full bg-background text-foreground font-mono text-sm leading-relaxed resize-none outline-none p-3 placeholder:text-muted-foreground/60"
          style={{ minHeight: '80px' }}
          spellCheck={false}
        />
      )}

      {!isDSL && (cell.state !== CELL_STATE.IDLE || cell.error) && (
        <>
          <Separator />
          {cell.state === CELL_STATE.TRANSLATING && (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="font-mono text-xs text-blue-500">NL → Workflow DSL (parse repair if needed)...</span>
            </div>
          )}
          {cell.error && cell.state === CELL_STATE.ERROR && !cell.nodes && (
            <div className="p-3">
              <Alert variant="error">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs">Error</AlertTitle>
                <AlertDescription className="text-xs font-mono mt-1">{cell.error}</AlertDescription>
              </Alert>
            </div>
          )}
          {cell.state === CELL_STATE.TRANSLATED && cell.dslSource != null && (
            <div className="px-4 py-3 bg-muted/20">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                  Out [{cell.executionNumber || ' '}]:
                </span>
                <Badge variant="stage1" className="text-[10px]">Workflow DSL (.wfl)</Badge>
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
                  <div className="absolute top-2 right-2 text-[10px] font-mono text-muted-foreground/60 pointer-events-none">.wfl</div>
                  <textarea
                    ref={translatedRef}
                    value={cell.dslSource}
                    onChange={(e) => onDSLSourceChange(e.target.value)}
                    onBlur={onDSLBlur}
                    className="w-full bg-background border border-yellow-300 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-300 rounded-md p-3 font-mono text-sm leading-relaxed resize-none outline-none cursor-text"
                    style={{ minHeight: '120px' }}
                    spellCheck={false}
                  />
                </div>
                {cell.syntaxError && (
                  <Alert variant="error" className="py-2 mb-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <AlertDescription className="text-[11px] font-mono">{cell.syntaxError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <Button variant="interpret" size="sm" onClick={(e) => { e.stopPropagation(); onInterpret() }} className="gap-1.5">
                    <Play className="h-3.5 w-3.5" />
                    Interpret
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Edit the DSL, then interpret or press{' '}
                    <kbd className="px-1 py-0.5 bg-muted border rounded text-[10px] font-mono">Shift+Enter</kbd>
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {cell.state === CELL_STATE.INTERPRETING && (
        <>
          <Separator />
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
            <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            <span className="font-mono text-xs text-purple-500">
              Semantic interpreter: prompt → LLM, code → exec...
            </span>
          </div>
        </>
      )}

      {(cell.state === CELL_STATE.COMPLETE || cell.state === CELL_STATE.PARTIAL || (cell.state === CELL_STATE.ERROR && cell.nodes)) && cell.nodes && (
        <>
          <Separator />
          <div className={`px-4 py-3 ${cell.state === CELL_STATE.COMPLETE ? 'bg-green-50/50' : 'bg-yellow-50/40'}`}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                Out [{cell.executionNumber || ' '}]:
              </span>
              <Badge variant={cell.state === CELL_STATE.COMPLETE ? 'stage2' : 'translated'} className="text-[10px]">
                {cell.state === CELL_STATE.COMPLETE ? 'Workflow output' : 'Partial output'}
              </Badge>
              {cell.interpretTime && (
                <span className="text-[10px] text-muted-foreground font-mono">{cell.interpretTime}s</span>
              )}
              <div className="flex flex-wrap gap-1">
                {cell.nodes.map((n, i) => (
                  <span
                    key={i}
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${
                      n.success
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-red-100 text-red-700 border-red-300'
                    }`}
                  >
                    {n.success ? '✓' : '✗'} {n.node_name}
                    <span className="opacity-60"> · {n.kind}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2 px-1">
              {cell.nodes.map((n, i) => (
                <div key={i} className="rounded-md border bg-background/80 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold">{n.node_name}</span>
                    <Badge variant="outline" className="text-[9px]">{n.kind}</Badge>
                    {n.output_name && (
                      <span className="text-[10px] font-mono text-muted-foreground">→ {n.output_name}</span>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">{n.duration_sec}s</span>
                  </div>
                  {n.error && (
                    <pre className="text-[11px] font-mono text-red-700 whitespace-pre-wrap mb-1">{n.error}</pre>
                  )}
                  {n.stdout && (
                    <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap mb-1">{n.stdout}</pre>
                  )}
                  {n.output_value && (
                    <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">{n.output_value}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {cell.error && cell.state === CELL_STATE.ERROR && !showResults && isDSL && (
        <>
          <Separator />
          <div className="p-3">
            <Alert variant="error">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs">Error</AlertTitle>
              <AlertDescription className="text-xs font-mono mt-1">{cell.error}</AlertDescription>
            </Alert>
          </div>
        </>
      )}
    </div>
  )
})

export default NotebookCell
