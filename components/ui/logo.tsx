'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
  href?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ href = '/', size = 'md', className }: LogoProps) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  }

  const content = (
    <span
      className={cn(
        sizes[size],
        'font-bold tracking-tight text-blue-600',
        'hover:text-blue-500 transition-colors',
        className
      )}
    >
      Open
      <span className="font-extrabold text-slate-900">Form</span>
    </span>
  )

  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
        {content}
      </Link>
    )
  }

  return content
}
