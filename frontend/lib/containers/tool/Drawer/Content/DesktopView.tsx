import type { FC } from 'react'

import { scrollDrawerToTop } from '~/dom'
import { ANCHOR } from '~/const/dom'

import Content from './Content'
import useSalon from '../salon/content'

type TProps = {
  type: string // TODO:
}

const DesktopView: FC<TProps> = ({ type }) => {
  const s = useSalon({ type })

  return (
    <div className={s.wrapper} style={s.wrapperStyle}>
      <div id={ANCHOR.DRAWER_HEAD} />
      <Content type={type} onLoad={() => scrollDrawerToTop()} />
    </div>
  )
}

export default DesktopView
