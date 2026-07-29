import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        jupyter: 'bg-[#FF6B19] text-white hover:bg-[#E85D10] border border-[#FF6B19]',
        'jupyter-outline': 'border border-[#CFCFCF] bg-[#F7F7F7] text-[#333] hover:bg-[#E8E8E8]',
        'jupyter-ghost': 'text-[#777] hover:text-[#333] hover:bg-[#F7F7F7]',
        translate: 'border border-[#FF6B19]/30 bg-[#FF6B19]/5 text-[#FF6B19] hover:bg-[#FF6B19]/15',
        interpret: 'border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 rounded-md px-2.5 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-8 w-8',
        'icon-sm': 'h-6 w-6',
        xs: 'h-6 rounded px-2 text-[11px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
