import { type FC, useState } from 'react'

import { FOOTER_LAYOUT } from '~/const/layout'
import Button from '~/widgets/Buttons/Button'
import ArrowSVG from '~/icons/ArrowSimple'

import { SETTING_FIELD } from '../../constant'
import SavingBar from '../../SavingBar'

import Simple from './Simple'
import Group from './Group'

import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../../salon/footer/templates'

const Templates: FC = () => {
  const s = useSalon()

  const { getIsLayoutTouched, footerLayout, saving, footerLinks, resetEditingLink } = useFooter()
  const [showAll, setShowAll] = useState<boolean>(false)

  const isLayoutTouched = getIsLayoutTouched('footerLayout')

  return (
    <div className={s.wrapper}>
      {showAll ? (
        <>
          <Simple $active={footerLayout === FOOTER_LAYOUT.SIMPLE} links={footerLinks} />
          <Group active={footerLayout === FOOTER_LAYOUT.GROUP} links={footerLinks} />
        </>
      ) : (
        <>
          {footerLayout === FOOTER_LAYOUT.SIMPLE && <Simple active links={footerLinks} />}
          {footerLayout === FOOTER_LAYOUT.GROUP && <Group active links={footerLinks} />}
        </>
      )}

      <SavingBar
        isTouched={isLayoutTouched}
        field={SETTING_FIELD.FOOTER_LAYOUT}
        onConfirm={() => setShowAll(false)}
        loading={saving}
        top={10}
        width="w-11/12"
      />

      {!isLayoutTouched && !saving && (
        <Button
          size="small"
          className="w-32"
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
