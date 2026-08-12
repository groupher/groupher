import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

type Props = { children: ReactNode }

export default function AppShell({ children }: Props) {
  return (
    <div className='apply-shell'>
      <header className='apply-header'>
        <Link className='apply-brand' to='/'>
          Groupher Apply
        </Link>
        <Link to='/review'>Review</Link>
      </header>
      <main className='apply-main'>{children}</main>
    </div>
  )
}
