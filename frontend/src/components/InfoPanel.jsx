import { Info, Keyboard } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'

function Kbd({ children }) {
  return (
    <kbd className="px-1.5 py-0.5 bg-white/60 border border-[#BCE8F1] rounded text-[10px] font-mono">
      {children}
    </kbd>
  )
}

export default function InfoPanel() {
  return (
    <Alert variant="info" className="relative">
      <Info className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">
        Two-Stage Processing Notebook
      </AlertTitle>
      <AlertDescription className="text-xs leading-relaxed">
        <p className="mb-2">
          This notebook processes text in <strong>two stages</strong>. Press the run button
          (or <Kbd>Shift+Enter</Kbd>) twice:
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white/40 rounded-md p-2.5 border border-[#BCE8F1]/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Badge variant="stage1" className="text-[9px] px-1.5 py-0">Stage 1</Badge>
              <span className="text-[11px] font-semibold">Translate</span>
            </div>
            <p className="text-[11px] opacity-90">
              Sends your text to the LLM to convert it to lowercase.
            </p>
          </div>
          <div className="bg-white/40 rounded-md p-2.5 border border-[#BCE8F1]/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Badge variant="stage2" className="text-[9px] px-1.5 py-0">Stage 2</Badge>
              <span className="text-[11px] font-semibold">Interpret</span>
            </div>
            <p className="text-[11px] opacity-90">
              Counts the word &ldquo;balloon&rdquo; and displays a balloon image for each.
            </p>
          </div>
        </div>

        <p className="text-[11px] mb-2">
          <strong>Try it:</strong>{' '}
          <code className="px-1.5 py-0.5 bg-white/50 border border-[#BCE8F1] rounded text-[10px] font-mono">
            I love BALLOONS! Red Balloon, blue BALLOON.
          </code>
        </p>

        <Separator className="my-2 bg-[#BCE8F1]/50" />

        <div className="flex items-center gap-1 flex-wrap text-[10px] opacity-80">
          <Keyboard className="h-3 w-3 mr-0.5" />
          <Kbd>Shift+Enter</Kbd> run
          <span className="mx-0.5">·</span>
          <Kbd>Alt+A</Kbd> add cell
          <span className="mx-0.5">·</span>
          <Kbd>Alt+D</Kbd> delete
          <span className="mx-0.5">·</span>
          <Kbd>Ctrl+/</Kbd> all shortcuts
        </div>
      </AlertDescription>
    </Alert>
  )
}
