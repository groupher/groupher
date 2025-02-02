import type { FC, ReactNode } from 'react'

import type { TSpace } from '~/spec'

import ThemeSelect from './ThemeSelect'
import useSalon, { cn } from '../salon/section_label'

type TProps = {
  title: string
  desc?: ReactNode
  addon?: ReactNode
  width?: string
  withThemeSelect?: boolean
  classNames?: string
} & TSpace

const SectionLabel: FC<TProps> = ({
  title,
  desc = null,
  addon = null,
  width = 'w-full',
  withThemeSelect = false,
  classNames = '',
  ...spacing
}) => {
  const s = useSalon({ width, desc, ...spacing })

  return (
    <div className={cn(s.wrapper, classNames)}>
      <div className={s.header}>
        <h3 className={s.title}>
          {title}
          {withThemeSelect && (
            <>
              <div className="grow" /> <ThemeSelect />
            </>
          )}
        </h3>
        <div className="grow" />
        {addon}
      </div>
      {desc && <div className={s.desc}>{desc}</div>}
    </div>
  )
}

export default SectionLabel
