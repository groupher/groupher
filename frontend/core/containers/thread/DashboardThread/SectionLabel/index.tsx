import type { FC, ReactNode } from 'react'
import ArrowButton from '~/widgets/Buttons/ArrowButton'

import type { TSpace } from '~/spec'
import useSalon, { cn } from '../salon/section_label'
import ThemeSelect from './ThemeSelect'

type TProps = {
  title: string
  desc?: string
  addon?: ReactNode
  width?: string
  withThemeSelect?: boolean
  classNames?: string
  detailText?: string
  showMoreButton?: boolean
  onDetailClick?: () => void
} & TSpace

const SectionLabel: FC<TProps> = ({
  title,
  desc = null,
  addon = null,
  width = 'w-full',
  withThemeSelect = false,
  detailText = "影响范围",
  classNames = '',
  showMoreButton = true,
  onDetailClick = () => {},
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
              <div className='grow' /> <ThemeSelect />
            </>
          )}
        </h3>
        <div className='grow' />
        {addon}
      </div>
      {desc && <div className={s.desc}>
        {desc}
        {showMoreButton && <ArrowButton left={0.5} onClick={onDetailClick}>{detailText}</ArrowButton>}
        </div>}
    </div>
  )
}

export default SectionLabel
