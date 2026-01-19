import { type FC, useState } from 'react'

import { FOOTER_LAYOUT } from '~/const/layout'
import ArrowSVG from '~/icons/ArrowSimple'
import Button from '~/widgets/Buttons/Button'

import { FIELD } from '../../constant'
import useFooter from '../../logic/useFooter'
import SavingBar from '../../SavingBar'
import useSalon, { cn } from '../../salon/footer/templates'
import Group from './Group'
import Simple from './Simple'

const Templates: FC = () => {
  const s = useSalon()

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
        loading={saving}
        top={10}
      />

      {!isLayoutTouched && !saving && (
        <Button
          size='small'
          className='w-32'
          ghost
          noBorder
          onClick={() => {
            setShowAll(!showAll)
            resetEditingLink()
          }}
        >
          {showAll ? '收起' : '更换模板'}
          <ArrowSVG className={cn(s.arrowIcon, showAll && 'rotate-90')} />
        </Button>
      )}
    </div>
  )
}

export default Templates
