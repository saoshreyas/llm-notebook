export default function InfoPanel() {
  return (
    <div className="bg-[#D9EDF7] border border-[#BCE8F1] rounded p-4">
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">📘</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#31708F] mb-1">
            Two-Stage Processing Notebook
          </h3>
          <p className="text-xs text-[#31708F] leading-relaxed mb-2">
            This notebook processes text in <strong>two stages</strong>. Press the run button (or <kbd className="px-1.5 py-0.5 bg-white/60 border border-[#BCE8F1] rounded text-[10px] font-mono">Shift+Enter</kbd>) twice:
          </p>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-white/50 rounded p-2">
              <p className="text-[11px] text-[#31708F]">
                <strong className="text-yellow-600">Stage 1 — Translate:</strong> Sends text to the
                LLM to convert it to lowercase.
              </p>
            </div>
            <div className="bg-white/50 rounded p-2">
              <p className="text-[11px] text-[#31708F]">
                <strong className="text-green-600">Stage 2 — Interpret:</strong> Counts the word
                "balloon" and displays a balloon image for each.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-[#31708F]">
            <strong>Try it:</strong>{' '}
            <code className="px-1.5 py-0.5 bg-white/60 border border-[#BCE8F1] rounded text-[10px] font-mono">
              I love BALLOONS! Red Balloon, blue BALLOON.
            </code>
          </p>
          <p className="text-[10px] text-[#31708F]/80 mt-1.5">
            Shortcuts:{' '}
            <kbd className="px-1 py-0.5 bg-white/60 border border-[#BCE8F1] rounded text-[9px] font-mono">Shift+Enter</kbd> run
            &nbsp;·&nbsp;
            <kbd className="px-1 py-0.5 bg-white/60 border border-[#BCE8F1] rounded text-[9px] font-mono">Alt+A</kbd> add cell
            &nbsp;·&nbsp;
            <kbd className="px-1 py-0.5 bg-white/60 border border-[#BCE8F1] rounded text-[9px] font-mono">Alt+D</kbd> delete
            &nbsp;·&nbsp;
            <kbd className="px-1 py-0.5 bg-white/60 border border-[#BCE8F1] rounded text-[9px] font-mono">Ctrl+/</kbd> help
          </p>
        </div>
      </div>
    </div>
  )
}
