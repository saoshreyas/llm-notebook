import { cn } from '@/lib/utils'

export function Card({ className, ...props }) {
  return <div className={cn('rounded border border-[#CFCFCF] bg-white', className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('px-4 py-3 border-b border-[#E8E8E8]', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-sm font-semibold text-[#333]', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-4 py-3', className)} {...props} />
}
