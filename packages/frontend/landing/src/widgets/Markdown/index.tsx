import type { ReactNode } from 'react'
import MarkdownRender from 'markdown-to-jsx'

import type { TSpace } from '~/spec'

import useSalon from './salon'

type TProps = {
  children: ReactNode
  className?: string
} & TSpace

export default ({ children, className = '', ...spacing }: TProps) => {
  const s = useSalon({ className, ...spacing })

  return (
    <div className={s.wrapper}>
      {/* @ts-ignore*/}
      <MarkdownRender>{children}</MarkdownRender>
    </div>
  )
}
