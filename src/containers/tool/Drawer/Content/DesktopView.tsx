import { type FC, memo, useEffect, useState } from 'react'

import { scrollDrawerToTop } from '~/dom'
import { ANCHOR } from '~/const/dom'

import Content from './Content'
import useSalon from '../salon/content'

type TProps = {
  type: string // TODO:
}

const DesktopView: FC<TProps> = ({ type }) => {
  const [wrapperStyle, setWrapperStyle] = useState({})
  const s = useSalon({ type })

  useEffect(() => {
    setWrapperStyle(s.wrapperStyle)
  }, [s.wrapperStyle])

  return (
    <div className={s.wrapper} style={wrapperStyle}>
      <div id={ANCHOR.DRAWER_HEAD} />
      <Content type={type} onLoad={() => scrollDrawerToTop()} />
    </div>
  )
}

export default memo(DesktopView)
