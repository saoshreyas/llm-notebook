import { Info, Keyboard } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
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
        Natural language → DSL → interpreter → output
      </AlertTitle>
      <AlertDescription className="text-xs leading-relaxed space-y-3">
        <div className="rounded-md border border-[#BCE8F1]/60 bg-white/30 px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Definitions
          </p>
          <p className="text-[11px]">
            <span className="font-semibold text-foreground">Natural language</span>
            {' — '}what you type as plain-English intent (goals, data, constraints).
          </p>
          <p className="text-[11px]">
            <span className="font-semibold text-foreground">DSL (NotebookDSL)</span>
            {' — '}structured <code className="text-[10px] font-mono">.ndsl</code> text:
            pipelines, <code className="text-[10px] font-mono">node</code> blocks, and{' '}
            <code className="text-[10px] font-mono">intent:</code> lines. Indentation is part of the
            language syntax (not nested notebook cells—each cell here is one flat block).
          </p>
          <p className="text-[11px]">
            <span className="font-semibold text-foreground">Interpreter</span>
            {' — '}parse DSL → for each node call the LLM to generate Python → checker verifies → run
            code; on checker or runtime errors, feed them back and retry up to the configured limit.
          </p>
          <p className="text-[11px]">
            <span className="font-semibold text-foreground">Output</span>
            {' — '}stdout, return values, and tracebacks from execution. Generated Python is run on the
            server but not shown in the UI; you see results after <strong>Run</strong>.
          </p>
        </div>

        <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-foreground/90 marker:font-mono marker:text-[11px]">
          <li>
            <strong>NL → DSL:</strong> LLM translates using a grammar cheat sheet and prior-cell
            history. If the parser rejects the program, the server asks the model to fix it (same
            endpoint, multiple attempts; override with env <code className="text-[10px] font-mono">NL_PARSE_MAX_ATTEMPTS</code>).
          </li>
          <li>
            <strong>Interpreter:</strong> each node becomes code; errors include checker violations
            and Python tracebacks so the model can correct before continuing.
          </li>
          <li>
            <strong>Output:</strong> run the merged pipeline execution step to view printed and
            returned results (and errors if any).
          </li>
        </ol>

        <p className="text-[11px]">
          <strong>Text mode</strong> walks those steps with <Kbd>Shift+Enter</Kbd>.
          <strong> DSL mode</strong> skips NL→DSL—you write <code className="text-[10px] font-mono">.ndsl</code>{' '}
          directly, then the same interpreter and output flow applies.
        </p>

        <p className="text-[10px] text-muted-foreground">
          Point the backend at your OpenAI-compatible server with{' '}
          <code className="font-mono">VLLM_BASE_URL</code> and choose a model with{' '}
          <code className="font-mono">DEFAULT_MODEL</code> (e.g. a small instruct model for faster iteration).
        </p>

        <Separator className="bg-[#BCE8F1]/50" />

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
