import { useEffect, useRef } from 'react'

const SHORTCUTS = [
  { keys: ['Shift', 'Enter'], desc: 'Run current cell (translate OR interpret)' },
  { keys: ['Ctrl', 'Enter'], desc: 'Run cell and insert new cell below' },
  { keys: ['Alt', 'A'], desc: 'Add new cell below' },
  { keys: ['Alt', 'D'], desc: 'Delete the focused cell' },
  { keys: ['Ctrl', '/'], desc: 'Toggle this shortcuts panel' },
  { keys: ['Esc'], desc: 'Close this dialog' },
]

const STATES = [
  { icon: '⚪', color: '#999', label: 'Not executed', desc: 'Cell has not been run yet' },
  { icon: '🔵', color: '#2196F3', label: 'Translating...', desc: 'Stage 1 is running (LLM lowercasing)' },
  { icon: '🟡', color: '#F0AD4E', label: 'Translated', desc: 'Stage 1 done — run again to interpret' },
  { icon: '🟣', color: '#9C27B0', label: 'Interpreting...', desc: 'Stage 2 is running (balloon counting)' },
  { icon: '🟢', color: '#4CAF50', label: 'Complete', desc: 'Both stages finished' },
  { icon: '🔴', color: '#D9534F', label: 'Error', desc: 'Something went wrong' },
]

const CAN_DO = [
  'Add unlimited cells (Alt+A or button)',
  'Delete any cell except the last one (Alt+D)',
  'Run cells in any order',
  'Re-run cells multiple times',
  'Clear output and restart from Stage 1',
  'Edit input text after running',
  'Use all keyboard shortcuts',
]

const CANNOT_DO = [
  'Delete the last remaining cell (always keep at least 1)',
]

export default function CommandBar({ onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-[10vh]"
    >
      <div className="bg-white rounded-lg shadow-2xl border border-[#CFCFCF] w-full max-w-[640px] max-h-[75vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#CFCFCF] bg-[#F7F7F7] rounded-t-lg">
          <h2 className="text-sm font-semibold text-[#333]">Keyboard Shortcuts & Help</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#E8E8E8] text-[#777] hover:text-[#333] transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Shortcuts */}
          <section>
            <h3 className="text-xs font-semibold text-[#333] uppercase tracking-wider mb-3">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#F7F7F7]">
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, j) => (
                      <span key={j} className="flex items-center gap-1">
                        {j > 0 && <span className="text-[#999] text-xs">+</span>}
                        <kbd className="px-2 py-0.5 text-[11px] font-mono font-medium bg-[#F7F7F7] border border-[#CFCFCF] rounded shadow-sm text-[#333]">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-[#555]">{s.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Cell states */}
          <section>
            <h3 className="text-xs font-semibold text-[#333] uppercase tracking-wider mb-3">
              Cell Execution States
            </h3>
            <div className="space-y-2">
              {STATES.map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[#F7F7F7]">
                  <span className="text-sm w-5 text-center">{s.icon}</span>
                  <span className="text-xs font-semibold min-w-[100px]" style={{ color: s.color }}>
                    {s.label}
                  </span>
                  <span className="text-xs text-[#555]">{s.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Can / Can't do */}
          <div className="grid grid-cols-2 gap-4">
            <section>
              <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">
                ✓ What you CAN do
              </h3>
              <ul className="space-y-1">
                {CAN_DO.map((item, i) => (
                  <li key={i} className="text-[11px] text-[#555] flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
                ✗ What you CANNOT do
              </h3>
              <ul className="space-y-1">
                {CANNOT_DO.map((item, i) => (
                  <li key={i} className="text-[11px] text-[#555] flex items-start gap-1.5">
                    <span className="text-red-500 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Two-stage explanation */}
          <section className="bg-[#D9EDF7] border border-[#BCE8F1] rounded p-3">
            <h3 className="text-xs font-semibold text-[#31708F] mb-1.5">
              ℹ Two-Stage Execution
            </h3>
            <p className="text-[11px] text-[#31708F] leading-relaxed">
              <strong>Stage 1 — Translate:</strong> Sends your text to the LLM which converts it to lowercase.
              The button shows "Translate" and the cell turns yellow when done.
            </p>
            <p className="text-[11px] text-[#31708F] leading-relaxed mt-1">
              <strong>Stage 2 — Interpret:</strong> Run again to count the word "balloon" and generate
              a balloon image for each occurrence. The cell turns green when complete.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
