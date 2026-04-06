import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react'
import {
  Play, RotateCcw, Trash2, Loader2, AlertCircle, CheckCircle2, Circle, Pencil,
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
    icon: Circle,
    label: 'Not executed',
    badgeVariant: 'idle',
    borderColor: 'transparent',
    spinning: false,
    progress: 0,
  },
  translating: {
    icon: Loader2,
    label: 'Translating...',
    badgeVariant: 'translating',
    borderColor: '#2196F3',
    spinning: true,
    progress: 33,
  },
  translated: {
    icon: CheckCircle2,
    label: 'Translated — edit below, then interpret',
    badgeVariant: 'translated',
    borderColor: '#F0AD4E',
    spinning: false,
    progress: 50,
  },
  interpreting: {
    icon: Loader2,
    label: 'Interpreting...',
    badgeVariant: 'interpreting',
    borderColor: '#9C27B0',
    spinning: true,
    progress: 75,
  },
  complete: {
    icon: CheckCircle2,
    label: 'Complete',
    badgeVariant: 'complete',
    borderColor: '#4CAF50',
    spinning: false,
    progress: 100,
  },
  error: {
    icon: AlertCircle,
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
  {
    cell, isFocused, onFocus,
    onRun, onTranslate, onInterpret,
    onClear, onDelete,
    onInputChange, onTranslatedTextChange,
    canDelete,
  },
  ref,
) {
  const textareaRef = useRef(null)
  const translatedRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  const cfg = STATE_CONFIG[cell.state] || STATE_CONFIG.idle
  const StateIcon = cfg.icon
  const isRunning = cell.state === CELL_STATE.TRANSLATING || cell.state === CELL_STATE.INTERPRETING
  const isTranslating = cell.state === CELL_STATE.TRANSLATING
  const isInterpreting = cell.state === CELL_STATE.INTERPRETING
  const showProgress = cell.state !== CELL_STATE.IDLE

  // Auto-resize input textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.max(80, ta.scrollHeight) + 'px'
    }
  }, [cell.input])

  // Auto-resize translated textarea
  useEffect(() => {
    const ta = translatedRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.max(48, ta.scrollHeight) + 'px'
    }
  }, [cell.translatedText])

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
      {/* Cell header — always shows Translate */}
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
          {/* Translate button — always in header */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="translate"
                size="xs"
                onClick={(e) => { e.stopPropagation(); onTranslate() }}
                disabled={isRunning || !cell.input.trim()}
                className="gap-1"
              >
                {isTranslating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {isTranslating ? 'Translating...' : 'Translate'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Stage 1: Translate text to lowercase via LLM (Shift+Enter)
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

          {/* Translating spinner */}
          {isTranslating && (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="font-mono text-xs text-blue-500">
                Translating with LLM...
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

          {/* Stage 1 output — editable translated text + Interpret button */}
          {cell.translatedText !== null && !isTranslating && (
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
                {cell.state === CELL_STATE.TRANSLATED && (
                  <Badge variant="outline" className="text-[10px] gap-1 ml-auto text-muted-foreground">
                    <Pencil className="h-2.5 w-2.5" />
                    Editable
                  </Badge>
                )}
              </div>

              <div className="ml-[82px]">
                {/* Editable textarea for translated text */}
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

                {/* Interpret button — appears here after translation */}
                {cell.state === CELL_STATE.TRANSLATED && (
                  <div className="flex items-center gap-3 mt-2.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="interpret"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); onInterpret() }}
                          className="gap-1.5"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Interpret
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Stage 2: Count &ldquo;balloon&rdquo; occurrences and generate images (Shift+Enter)
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-[11px] text-muted-foreground">
                      Edit the text above if needed, then click Interpret or press <kbd className="px-1 py-0.5 bg-muted border rounded text-[10px] font-mono">Shift+Enter</kbd>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interpreting spinner */}
          {isInterpreting && (
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              <span className="font-mono text-xs text-purple-500">
                Counting balloons & generating images...
              </span>
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
