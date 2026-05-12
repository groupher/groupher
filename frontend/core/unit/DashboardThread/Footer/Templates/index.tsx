import { type FC, useState } from 'react'

import { FOOTER_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import Button from '~/widgets/Buttons/Button'

import { FIELD } from '../../constant'
import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../../salon/footer/templates'
import SavingBar from '../../SavingBar'
import Group from './Group'
import Simple from './Simple'

const Templates: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  const {
    isFooterLayoutTouched: isLayoutTouched,
    footerLayout,
    saving,
    footerLinks,
    resetEditingLink,
  } = useFooter()

  const [showAll, setShowAll] = useState(false)

  return (
    <div className={s.wrapper}>
      <fieldset className='w-full'>
        <legend className='sr-only'>Footer layout</legend>

        <div className={s.options}>
          <div
            aria-hidden={!showAll && footerLayout !== FOOTER_LAYOUT.SIMPLE}
            className={cn(!showAll && footerLayout !== FOOTER_LAYOUT.SIMPLE && 'hidden')}
          >
            <Simple
              active={footerLayout === FOOTER_LAYOUT.SIMPLE}
              links={footerLinks}
              previewOnly
            />
          </div>

          <div
            aria-hidden={!showAll && footerLayout !== FOOTER_LAYOUT.GROUP}
            className={cn(!showAll && footerLayout !== FOOTER_LAYOUT.GROUP && 'hidden')}
          >
            <Group active={footerLayout === FOOTER_LAYOUT.GROUP} links={footerLinks} previewOnly />
          </div>
        </div>
      </fieldset>

      <SavingBar
        isTouched={isLayoutTouched}
        field={FIELD.FOOTER_LAYOUT}
        onConfirm={() => setShowAll(false)}
        top={10}
      />

      <div className={s.action}>
        {!isLayoutTouched && !saving && (
          <Button
            size='small'
            ghost
            noBorder
            onClick={() => {
              setShowAll(!showAll)
              resetEditingLink()
            }}
          >
            {showAll ? t('dsb.footer.templates.collapse') : t('dsb.footer.templates.switch')}
            <ArrowSVG className={cn(s.arrowIcon, showAll ? 'rotate-90' : 'rotate-180')} />
          </Button>
        )}
      </div>
    </div>
  )
}

export default Templates
