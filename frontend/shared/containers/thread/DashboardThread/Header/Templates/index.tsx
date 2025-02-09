import { type FC, useState } from 'react'

import { HEADER_LAYOUT } from '~/const/layout'

import ArrowSVG from '~/icons/ArrowSimple'
import Button from '~/widgets/Buttons/Button'

import { SETTING_FIELD } from '../../constant'
import SavingBar from '../../SavingBar'

import Center from './Center'
import Float from './Float'
import Right from './Right'

import useHeader from '../../logic/useHeader'
import useSalon, { cn } from '../../salon/header/templates'

const Templates: FC = () => {
  const [showAll, setShowAll] = useState<boolean>(false)
  const s = useSalon()

  const { getIsLayoutTouched, headerLayout, saving, headerLinks: links, getThreads } = useHeader()
  const threads = getThreads()
  const linksProps = { threads, links }

  const isLayoutTouched = getIsLayoutTouched()

  return (
    <div className={s.wrapper}>
      {showAll ? (
        <>
          <Center {...linksProps} active={headerLayout === HEADER_LAYOUT.CENTER} />
          <Right {...linksProps} active={headerLayout === HEADER_LAYOUT.RIGHT} />
          <Float {...linksProps} active={headerLayout === HEADER_LAYOUT.FLOAT} />
        </>
      ) : (
        <div className="w-full" onClick={() => setShowAll(true)}>
          {headerLayout === HEADER_LAYOUT.CENTER && <Center {...linksProps} active />}
          {headerLayout === HEADER_LAYOUT.RIGHT && <Right {...linksProps} active />}
          {headerLayout === HEADER_LAYOUT.FLOAT && <Float {...linksProps} active />}
        </div>
      )}

      <SavingBar
        isTouched={isLayoutTouched}
        field={SETTING_FIELD.HEADER_LAYOUT}
        onConfirm={() => setShowAll(false)}
        loading={saving}
        top={10}
      />

      <div className="w-11/12 align-both">
        {!isLayoutTouched && !saving && (
          <Button size="small" ghost noBorder className="w-36" onClick={() => setShowAll(!showAll)}>
            {showAll ? '收起' : '更换模板'}

            <ArrowSVG className={cn(s.arrowIcon, showAll && 'rotate-90')} />
          </Button>
        )}
      </div>
    </div>
  )
}

export default Templates
