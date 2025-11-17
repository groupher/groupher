'use client'

/*
 *
 * Footer
 *
 */

import { FOOTER_LAYOUT } from '~/const/layout'
import useFooterLinks from '~/hooks/useFooterLinks'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import GroupLayout from './GroupLayout'
import PowerbyInfo from './PowerbyInfo'
import SimpleLayout from './SimpleLayout'

import useSalon from './salon'

export default () => {
  const s = useSalon()

  const { slug } = useViewingCommunity()
  const { layout } = useFooterLinks()

  if (!slug) return null // TODO: link to groupher home

  return (
    <footer className={s.wrapper}>
      {layout === FOOTER_LAYOUT.GROUP ? <GroupLayout /> : <SimpleLayout />}
      <PowerbyInfo />
    </footer>
  )
}
