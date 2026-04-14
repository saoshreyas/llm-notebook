import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        idle: 'border-gray-200 bg-gray-50 text-gray-500',
        translating: 'border-blue-200 bg-blue-50 text-blue-700',
        translated: 'border-yellow-200 bg-yellow-50 text-yellow-800',
        interpreting: 'border-purple-200 bg-purple-50 text-purple-700',
        complete: 'border-green-200 bg-green-50 text-green-700',
        error: 'border-red-200 bg-red-50 text-red-700',
        stage1: 'border-yellow-200 bg-yellow-100 text-yellow-800',
        stage2: 'border-green-200 bg-green-100 text-green-800',
        connected: 'border-green-300 bg-green-50 text-green-700',
        disconnected: 'border-red-300 bg-red-50 text-red-700',
        checking: 'border-gray-300 bg-gray-50 text-gray-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
