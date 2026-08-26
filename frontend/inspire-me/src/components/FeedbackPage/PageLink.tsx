import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

type Props = {
  platformId: string
  page: number
  active?: boolean
  disabled?: boolean
  children: ReactNode
}

export default function PageLink({
  platformId,
  page,
  active = false,
  disabled = false,
  children,
}: Props) {
  const baseClass =
    'inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[13px] leading-none font-semibold no-underline'
  if (disabled) return <span className={`${baseClass} text-[#c2c2c2]`}>{children}</span>

  return (
    <Link
      className={`${baseClass} ${active ? 'bg-hover text-title' : 'text-digest hover:bg-hover hover:text-title'}`}
      to='/$platform'
      params={{ platform: platformId }}
      search={page <= 1 ? {} : { page: String(page) }}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  )
}
