'use client'

/*
 *
 * Footer
 *
 */

import { FOOTER_LAYOUT } from '~/const/layout'
import useFooterLinks from '~/hooks/useFooterLinks'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import SimpleLayout from './SimpleLayout'
import GroupLayout from './GroupLayout'
import PowerbyInfo from './PowerbyInfo'

import useSalon from './salon'

export default () => {
  const s = useSalon()

  const { slug } = useViewingCommunity()
  const { layout } = useFooterLinks()

  if (!slug) return null // TODO: link to groupher home

  return (
    <div className={s.wrapper}>
      {layout === FOOTER_LAYOUT.GROUP ? <GroupLayout /> : <SimpleLayout />}
      <PowerbyInfo />
    </div>
  )
}
