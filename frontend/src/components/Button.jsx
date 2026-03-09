import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-[#FF6B19] text-white hover:bg-[#E85D10] border-transparent',
  outline: 'bg-white text-[#333] border-[#CFCFCF] hover:bg-[#F7F7F7]',
  ghost: 'bg-transparent text-[#333] border-transparent hover:bg-[#F7F7F7]',
  destructive: 'bg-red-500 text-white hover:bg-red-600 border-transparent',
}

const sizes = {
  default: 'px-4 py-2 text-sm',
  sm: 'px-2.5 py-1.5 text-xs',
  lg: 'px-6 py-2.5 text-sm',
  icon: 'p-2',
}

export function Button({ className, variant = 'default', size = 'default', ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded border transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
