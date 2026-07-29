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
        Natural language → Workflow DSL → semantic interpreter → output
      </AlertTitle>
      <AlertDescription className="text-xs leading-relaxed space-y-3">
        <div className="rounded-md border border-[#BCE8F1]/60 bg-white/30 px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Definitions
          </p>
          <p className="text-[11px]">
            <span className="font-semibold text-foreground">Natural language</span>
            {' — '}plain-English goals (tasks, constraints, agent steps).
          </p>
          <p className="text-[11px]">
            <span className="font-semibold text-foreground">Workflow DSL (.wfl)</span>
            {' — '}structured program: <code className="text-[10px] font-mono">workflow</code>,{' '}
            <code className="text-[10px] font-mono">node</code> blocks with{' '}
            <code className="text-[10px] font-mono">kind: prompt</code> or{' '}
            <code className="text-[10px] font-mono">kind: code</code>. Indentation is language syntax
            inside the cell — notebook cells themselves stay flat.
          </p>
          <p className="text-[11px]">
            <span className="font-semibold text-foreground">Semantic interpreter</span>
            {' — '}does what the DSL means: prompt nodes call OpenRouter; code nodes run your Python.
            No LLM code generation. Constraints may trigger a self-check retry.
          </p>
          <p className="text-[11px]">
            <span className="font-semibold text-foreground">Output</span>
            {' — '}per-node results (text, values, stdout, errors) accumulated in the balloon for later nodes/cells.
          </p>
        </div>

        <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-foreground/90 marker:font-mono marker:text-[11px]">
          <li>
            <strong>NL → DSL:</strong> LLM writes <code className="text-[10px] font-mono">.wfl</code> using
            a grammar cheat sheet and prior-cell history. Parse failures are repaired automatically.
          </li>
          <li>
            <strong>Interpret:</strong> each node runs in order; prompt templates use double-brace variables that pull from earlier outputs.
          </li>
          <li>
            <strong>Review:</strong> edit the DSL before interpreting; inspect per-node outputs after.
          </li>
        </ol>

        <p className="text-[11px]">
          <strong>Text mode</strong> walks those steps with <Kbd>Shift+Enter</Kbd>.
          <strong> DSL mode</strong> skips NL — write <code className="text-[10px] font-mono">.wfl</code> and interpret.
        </p>

        <p className="text-[10px] text-muted-foreground">
          Set <code className="font-mono">OPENROUTER_API_KEY</code> and{' '}
          <code className="font-mono">DEFAULT_MODEL</code> (e.g.{' '}
          <code className="font-mono">openrouter/openai/gpt-oss-20b:free</code>).
        </p>

        <Separator className="bg-[#BCE8F1]/50" />

        <div className="flex items-center gap-1 flex-wrap text-[10px] opacity-80">
          <Keyboard className="h-3 w-3 mr-0.5" />
          <Kbd>Shift+Enter</Kbd> run
          <span className="mx-1">·</span>
          <Kbd>Alt+A</Kbd> add cell
          <span className="mx-1">·</span>
          <Kbd>Ctrl+/</Kbd> help
        </div>
      </AlertDescription>
    </Alert>
  )
}
