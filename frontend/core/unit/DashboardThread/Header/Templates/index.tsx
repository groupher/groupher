import { type FC, useState } from 'react'

import { HEADER_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import type { TLinkItem } from '~/spec'
import Button from '~/widgets/Buttons/Button'

import { FIELD } from '../../constant'
import useHeader from '../../logic/useHeader'
import SavingBar from '../../SavingBar'
import useSalon, { cn } from '../salon/templates'
import Center from './Center'
import Float from './Float'
import Right from './Right'

type TProps = {
  links: readonly TLinkItem[]
}

const Templates: FC<TProps> = ({ links }) => {
  const [showAll, setShowAll] = useState(false)
  const s = useSalon()
  const { t } = useTrans()

  const { isClassicLayoutTouched: isLayoutTouched, headerLayout, saving, threads } = useHeader()

  const linksProps = { threads, links }

  return (
    <div className={s.wrapper}>
      <fieldset className='w-full'>
        <legend className='sr-only'>Header layout</legend>

        <div className={s.options}>
          <div
            aria-hidden={!showAll && headerLayout !== HEADER_LAYOUT.CENTER}
            className={cn(!showAll && headerLayout !== HEADER_LAYOUT.CENTER && 'hidden')}
          >
            <Center {...linksProps} active={headerLayout === HEADER_LAYOUT.CENTER} />
          </div>

          <div
            aria-hidden={!showAll && headerLayout !== HEADER_LAYOUT.RIGHT}
            className={cn(!showAll && headerLayout !== HEADER_LAYOUT.RIGHT && 'hidden')}
          >
            <Right {...linksProps} active={headerLayout === HEADER_LAYOUT.RIGHT} />
          </div>

          <div
            aria-hidden={!showAll && headerLayout !== HEADER_LAYOUT.FLOAT}
            className={cn(!showAll && headerLayout !== HEADER_LAYOUT.FLOAT && 'hidden')}
          >
            <Float {...linksProps} active={headerLayout === HEADER_LAYOUT.FLOAT} />
          </div>
        </div>
      </fieldset>

      <SavingBar
        isTouched={isLayoutTouched}
        field={FIELD.HEADER_LAYOUT}
        onConfirm={() => setShowAll(false)}
        top={10}
      />

      <div className={s.action}>
        {!isLayoutTouched && !saving && (
          <Button size='small' ghost noBorder onClick={() => setShowAll(!showAll)}>
            {showAll ? t('dsb.header.templates.collapse') : t('dsb.header.templates.switch')}
            <ArrowSVG className={cn(s.arrowIcon, showAll ? 'rotate-90' : 'rotate-180')} />
          </Button>
        )}
      </div>
    </div>
  )
}

export default Templates
