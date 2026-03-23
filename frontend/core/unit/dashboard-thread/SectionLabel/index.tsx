import type { FC, ReactNode } from 'react'
import type { TSpace } from '~/spec'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import useTrans from '~/hooks/useTrans'
import useSalon, { cnMerge } from '../salon/section_label'
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
  detailText = null,
  classNames = '',
  showMoreButton = true,
  onDetailClick = () => {},
  ...spacing
}) => {
  const s = useSalon({ width, desc, ...spacing })
  const { t } = useTrans()
  const resolvedDetailText = detailText ?? t('dsb.section_label.detail')

  return (
    <div className={cnMerge(s.wrapper, classNames)}>
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
      {desc && (
        <div className={s.desc}>
          {desc}
          {showMoreButton && (
            <ArrowButton left={0.5} onClick={onDetailClick}>
              {resolvedDetailText}
            </ArrowButton>
          )}
        </div>
      )}
    </div>
  )
}

export default SectionLabel
