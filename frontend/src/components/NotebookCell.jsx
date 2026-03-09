import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react'

const STATE_CONFIG = {
  idle: {
    icon: '⚪',
    label: 'Not executed',
    color: '#999',
    borderColor: 'transparent',
    spinning: false,
  },
  translating: {
    icon: '🔵',
    label: 'Translating...',
    color: '#2196F3',
    borderColor: '#2196F3',
    spinning: true,
  },
  translated: {
    icon: '🟡',
    label: 'Translated (run again to interpret)',
    color: '#F0AD4E',
    borderColor: '#F0AD4E',
    spinning: false,
  },
  interpreting: {
    icon: '🟣',
    label: 'Interpreting...',
    color: '#9C27B0',
    borderColor: '#9C27B0',
    spinning: true,
  },
  complete: {
    icon: '🟢',
    label: 'Complete',
    color: '#4CAF50',
    borderColor: '#4CAF50',
    spinning: false,
  },
  error: {
    icon: '🔴',
    label: 'Error',
    color: '#D9534F',
    borderColor: '#D9534F',
    spinning: false,
  },
}

const NotebookCell = forwardRef(function NotebookCell(
  { cell, isFocused, onFocus, onRun, onClear, onDelete, onInputChange, canDelete, cellState },
  ref
) {
  const containerRef = useRef(null)
  const textareaRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  const cfg = STATE_CONFIG[cell.state] || STATE_CONFIG.idle

  const getButtonLabel = () => {
    if (cell.state === cellState.TRANSLATING || cell.state === cellState.INTERPRETING) return 'Running...'
    if (cell.state === cellState.TRANSLATED) return '▶ Interpret'
    if (cell.state === cellState.COMPLETE) return '▶ Translate'
    return '▶ Translate'
  }

  const isRunning = cell.state === cellState.TRANSLATING || cell.state === cellState.INTERPRETING

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.max(80, ta.scrollHeight) + 'px'
    }
  }, [cell.input])

  const leftBorderColor =
    cell.state === cellState.TRANSLATED ? '#F0AD4E' :
    cell.state === cellState.COMPLETE ? '#4CAF50' :
    cell.state === cellState.ERROR ? '#D9534F' :
    'transparent'

  return (
    <div
      ref={containerRef}
      onClick={onFocus}
      className={`relative border rounded-sm mb-0 transition-all duration-150 ${
        isFocused ? 'cell-focused' : 'border-[#CFCFCF]'
      }`}
      style={{
        borderLeft: `4px solid ${leftBorderColor}`,
        background: '#fff',
      }}
    >
      {/* Cell header with state indicator and controls */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#F7F7F7] border-b border-[#CFCFCF]">
        <div className="flex items-center gap-3">
          {/* Execution label */}
          <span className="font-mono text-xs text-[#999] select-none min-w-[70px]">
            In [{cell.executionNumber || ' '}]:
          </span>

          {/* State indicator */}
          <div className="flex items-center gap-1.5">
            {cfg.spinning ? (
              <span className="inline-block w-3.5 h-3.5 border-2 rounded-full animate-spin"
                style={{
                  borderColor: `${cfg.color}33`,
                  borderTopColor: cfg.color,
                }} />
            ) : (
              <span className="text-xs">{cfg.icon}</span>
            )}
            <span className="text-[11px] font-medium" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onRun() }}
            disabled={isRunning || !cell.input.trim()}
            className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors ${
              isRunning || !cell.input.trim()
                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                : cell.state === cellState.TRANSLATED
                  ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                  : 'border-[#FF6B19]/30 bg-[#FF6B19]/5 text-[#FF6B19] hover:bg-[#FF6B19]/10'
            }`}
          >
            {getButtonLabel()}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onClear() }}
            disabled={cell.state === cellState.IDLE}
            className="px-2 py-1 text-[11px] rounded border border-transparent hover:border-[#CFCFCF] text-[#777] hover:text-[#333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Clear output"
          >
            Clear
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            disabled={!canDelete}
            className="px-2 py-1 text-[11px] rounded border border-transparent hover:border-red-200 text-[#777] hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={canDelete ? 'Delete cell (Alt+D)' : 'Cannot delete last cell'}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Input area */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={cell.input}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={onFocus}
          placeholder={'Enter text here... Try: "I love BALLOONS! Red Balloon, blue BALLOON."\n\nShift+Enter to run  •  Alt+A to add cell  •  Ctrl+/ for help'}
          className="w-full bg-white text-[#333] font-mono text-sm leading-relaxed resize-none outline-none p-3"
          style={{ minHeight: '80px' }}
          spellCheck={false}
        />
      </div>

      {/* Output area */}
      {(cell.state !== cellState.IDLE || cell.error) && (
        <div className="border-t border-[#CFCFCF]">
          {/* Loading state */}
          {(cell.state === cellState.TRANSLATING || cell.state === cellState.INTERPRETING) && (
            <div className="flex items-center gap-3 px-3 py-3 bg-[#FAFAFA]">
              <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                style={{
                  borderColor: `${cfg.color}33`,
                  borderTopColor: cfg.color,
                }} />
              <span className="font-mono text-xs" style={{ color: cfg.color }}>
                {cell.state === cellState.TRANSLATING ? 'Translating with LLM...' : 'Counting balloons & generating images...'}
              </span>
            </div>
          )}

          {/* Error state */}
          {cell.error && (
            <div className="px-3 py-3 bg-[#FDF2F2] border-l-4 border-red-400">
              <div className="flex items-start gap-2">
                <span className="text-red-500 text-sm">✕</span>
                <div>
                  <p className="text-xs font-semibold text-red-700">Error</p>
                  <p className="text-xs text-red-600 font-mono mt-0.5">{cell.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Translated output */}
          {cell.translatedText !== null && cell.state !== cellState.TRANSLATING && (
            <div className="px-3 py-3 bg-[#FAFAFA]">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-[#999] min-w-[70px]">
                  Out [{cell.executionNumber || ' '}]:
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">
                  Stage 1: Translation
                </span>
                {cell.translateTime != null && (
                  <span className="text-[10px] text-[#999] font-mono">{cell.translateTime}s</span>
                )}
              </div>
              <div className="ml-[82px] bg-white border border-[#E8E8E8] rounded p-3 font-mono text-sm text-[#333] leading-relaxed">
                {cell.translatedText}
              </div>
            </div>
          )}

          {/* Balloon output */}
          {cell.state === cellState.COMPLETE && (
            <div className="px-3 py-3 bg-[#F5FFF5] border-t border-[#E8E8E8]">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-xs text-[#999] min-w-[70px]">
                  Out [{cell.executionNumber || ' '}]:
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">
                  Stage 2: Interpretation
                </span>
                {cell.interpretTime != null && (
                  <span className="text-[10px] text-[#999] font-mono">{cell.interpretTime}s</span>
                )}
              </div>

              <div className="ml-[82px]">
                {cell.balloonCount > 0 ? (
                  <div>
                    <p className="text-sm text-[#333] mb-3">
                      🎈 Found <strong>{cell.balloonCount}</strong> balloon{cell.balloonCount !== 1 ? 's' : ''} in the text!
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {cell.balloonImages.map((uri, i) => (
                        <div
                          key={i}
                          className="animate-float-in hover:scale-110 hover:-translate-y-1 transition-transform duration-200 cursor-pointer"
                          style={{ animationDelay: `${i * 80}ms` }}
                        >
                          <img src={uri} alt={`Balloon ${i + 1}`} className="w-[80px] h-auto drop-shadow-md" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#777] font-mono">
                    No balloons detected in the text.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default NotebookCell
