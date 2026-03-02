import { useState } from 'react'
import { Play, Trash2, X } from 'lucide-react'
import { Button } from './Button'
import { Card, CardContent, CardHeader } from './Card'
import { cn } from '@/lib/utils'

export function NotebookCell({ cellId, onDelete, onRun }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleRun = async () => {
    if (!input.trim()) {
      setError('Please enter some text to process')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await onRun(input)
      setOutput(result)
    } catch (err) {
      setError(err.message || 'An error occurred while processing')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setOutput(null)
    setError(null)
  }

  const handleKeyDown = (e) => {
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-lg animate-float-in">
      <CardHeader className="bg-muted/50 border-b border-border p-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-primary font-semibold">
            In [{cellId}]:
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isLoading}
            className="gap-2"
          >
            <Play className="h-3 w-3" />
            {isLoading ? 'Running...' : 'Run'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={!output && !error}
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(cellId)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your text here... Try mentioning BALLOON multiple times! (Shift+Enter to run)"
            className="w-full min-h-[120px] bg-background border-none p-4 font-mono text-sm resize-vertical focus:outline-none focus:ring-0"
          />
        </div>

        {(output || error || isLoading) && (
          <div className="border-t border-border bg-muted/20 p-4 animate-float-in">
            {isLoading && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="h-5 w-5 border-2 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
                <span className="font-mono text-sm">Processing with LLM...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded">
                <p className="font-mono text-sm text-red-500">❌ {error}</p>
              </div>
            )}

            {output && (
              <div className="space-y-4">
                <OutputSection label="Original Input" content={output.original_text} />
                <OutputSection label="Translated (Lowercase)" content={output.translated_text} />
                
                {output.balloon_count > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-1 w-1 bg-accent rounded-full" />
                      <span className="font-mono text-xs text-accent uppercase tracking-wider">
                        Balloon Interpretation ({output.balloon_count} balloon{output.balloon_count !== 1 ? 's' : ''} detected)
                      </span>
                    </div>
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                      {output.balloon_images.map((uri, i) => (
                        <div
                          key={i}
                          className="animate-float-in hover:scale-110 hover:-translate-y-2 transition-transform duration-300 cursor-pointer"
                          style={{ animationDelay: `${i * 0.1}s` }}
                        >
                          <img
                            src={uri}
                            alt={`Balloon ${i + 1}`}
                            className="w-full h-auto drop-shadow-lg"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {output.balloon_count === 0 && (
                  <div className="text-muted-foreground font-mono text-sm">
                    No balloons detected in the input text.
                  </div>
                )}

                <div className="text-xs text-muted-foreground font-mono pt-2 border-t border-border">
                  Processing time: {output.processing_time}s
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OutputSection({ label, content }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-1 w-1 bg-accent rounded-full" />
        <span className="font-mono text-xs text-accent uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="bg-background/50 border-l-4 border-primary p-4 rounded font-serif text-foreground leading-relaxed">
        {content}
      </div>
    </div>
  )
}
