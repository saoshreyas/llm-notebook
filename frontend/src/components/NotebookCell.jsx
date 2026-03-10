import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react'
import { Play, RotateCcw, Trash2, Loader2, AlertCircle, CheckCircle2, Circle } from 'lucide-react'

import { CELL_STATE } from '../App'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { Separator } from './ui/separator'

const STATE_CONFIG = {
  idle: {
    icon: Circle,
    emoji: '⚪',
    label: 'Not executed',
    badgeVariant: 'idle',
    borderColor: 'transparent',
    spinning: false,
    progress: 0,
  },
  translating: {
    icon: Loader2,
    emoji: '🔵',
    label: 'Translating...',
    badgeVariant: 'translating',
    borderColor: '#2196F3',
    spinning: true,
    progress: 33,
  },
  translated: {
    icon: CheckCircle2,
    emoji: '🟡',
    label: 'Translated — run again to interpret',
    badgeVariant: 'translated',
    borderColor: '#F0AD4E',
    spinning: false,
    progress: 50,
  },
  interpreting: {
    icon: Loader2,
    emoji: '🟣',
    label: 'Interpreting...',
    badgeVariant: 'interpreting',
    borderColor: '#9C27B0',
    spinning: true,
    progress: 75,
  },
  complete: {
    icon: CheckCircle2,
    emoji: '🟢',
    label: 'Complete',
    badgeVariant: 'complete',
    borderColor: '#4CAF50',
    spinning: false,
    progress: 100,
  },
  error: {
    icon: AlertCircle,
    emoji: '🔴',
    label: 'Error',
    badgeVariant: 'error',
    borderColor: '#D9534F',
    spinning: false,
    progress: 0,
  },
}

const PROGRESS_COLORS = {
  translating: 'bg-blue-500',
  translated: 'bg-yellow-500',
  interpreting: 'bg-purple-500',
  complete: 'bg-green-500',
  error: 'bg-red-500',
}

const NotebookCell = forwardRef(function NotebookCell(
  { cell, isFocused, onFocus, onRun, onClear, onDelete, onInputChange, canDelete },
  ref,
) {
  const textareaRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  const cfg = STATE_CONFIG[cell.state] || STATE_CONFIG.idle
  const StateIcon = cfg.icon
  const isRunning = cell.state === CELL_STATE.TRANSLATING || cell.state === CELL_STATE.INTERPRETING
  const showProgress = cell.state !== CELL_STATE.IDLE

  const getRunVariant = () => {
    if (isRunning || !cell.input.trim()) return 'jupyter-outline'
    if (cell.state === CELL_STATE.TRANSLATED) return 'interpret'
    return 'translate'
  }

  const getRunLabel = () => {
    if (isRunning) return 'Running...'
    if (cell.state === CELL_STATE.TRANSLATED) return 'Interpret'
    return 'Translate'
  }

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.max(80, ta.scrollHeight) + 'px'
    }
  }, [cell.input])

  const leftBorderColor =
    cell.state === CELL_STATE.TRANSLATED ? '#F0AD4E' :
    cell.state === CELL_STATE.COMPLETE ? '#4CAF50' :
    cell.state === CELL_STATE.ERROR ? '#D9534F' :
    'transparent'

  return (
    <div
      onClick={onFocus}
      className={`relative border rounded-md mb-0 transition-all duration-150 overflow-hidden ${
        isFocused ? 'cell-focused' : 'border-border'
      }`}
      style={{ borderLeft: `4px solid ${leftBorderColor}` }}
    >
      {/* Cell header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs text-muted-foreground select-none min-w-[70px]">
            In [{cell.executionNumber || ' '}]:
          </span>

          {/* State badge */}
          <Badge variant={cfg.badgeVariant} className="gap-1">
            <StateIcon className={`h-3 w-3 ${cfg.spinning ? 'animate-spin' : ''}`} />
            {cfg.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={getRunVariant()}
                size="xs"
                onClick={(e) => { e.stopPropagation(); onRun() }}
                disabled={isRunning || !cell.input.trim()}
                className="gap-1"
              >
                {isRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {getRunLabel()}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {cell.state === CELL_STATE.TRANSLATED
                ? 'Stage 2: Count balloons & generate images (Shift+Enter)'
                : 'Stage 1: Translate text to lowercase via LLM (Shift+Enter)'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="jupyter-ghost"
                size="icon-sm"
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
                variant="jupyter-ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                disabled={!canDelete}
                className="hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {canDelete ? 'Delete cell (Alt+D)' : 'Cannot delete the last cell'}
            </TooltipContent>
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

      {/* Input textarea */}
      <div className="relative">
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
      </div>

      {/* Output area */}
      {(cell.state !== CELL_STATE.IDLE || cell.error) && (
        <>
          <Separator />

          {/* Loading indicator */}
          {isRunning && (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: cfg.borderColor }} />
              <span className="font-mono text-xs" style={{ color: cfg.borderColor }}>
                {cell.state === CELL_STATE.TRANSLATING
                  ? 'Translating with LLM...'
                  : 'Counting balloons & generating images...'}
              </span>
            </div>
          )}

          {/* Error */}
          {cell.error && (
            <div className="p-3">
              <Alert variant="error">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs">Execution Error</AlertTitle>
                <AlertDescription className="text-xs font-mono mt-1">
                  {cell.error}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Stage 1 output */}
          {cell.translatedText !== null && cell.state !== CELL_STATE.TRANSLATING && (
            <div className="px-4 py-3 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                  Out [{cell.executionNumber || ' '}]:
                </span>
                <Badge variant="stage1" className="text-[10px]">
                  Stage 1: Translation
                </Badge>
                {cell.translateTime != null && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {cell.translateTime}s
                  </span>
                )}
              </div>
              <div className="ml-[82px] bg-background border rounded-md p-3 font-mono text-sm leading-relaxed">
                {cell.translatedText}
              </div>
            </div>
          )}

          {/* Stage 2 output */}
          {cell.state === CELL_STATE.COMPLETE && (
            <>
              <Separator />
              <div className="px-4 py-3 bg-green-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                    Out [{cell.executionNumber || ' '}]:
                  </span>
                  <Badge variant="stage2" className="text-[10px]">
                    Stage 2: Interpretation
                  </Badge>
                  {cell.interpretTime != null && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {cell.interpretTime}s
                    </span>
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
                                <img
                                  src={uri}
                                  alt={`Balloon ${i + 1}`}
                                  className="w-[80px] h-auto drop-shadow-md"
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Balloon {i + 1}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Alert variant="info" className="py-2">
                      <AlertDescription className="text-sm font-mono">
                        No balloons detected in the text.
                      </AlertDescription>
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
