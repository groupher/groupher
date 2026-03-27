'use client'

/*
 *
 * Footer
 *
 */

import { FOOTER_LAYOUT } from '~/const/layout'
import useFooterLinks from '~/hooks/useFooterLinks'
import useCommunity from '~/stores/community/hooks'
import GroupLayout from './GroupLayout'
import PowerbyInfo from './PowerbyInfo'
import SimpleLayout from './SimpleLayout'

import useSalon from './salon'

export default function Footer() {
  const s = useSalon()

  const { slug } = useCommunity()
  const { layout } = useFooterLinks()

  if (!slug) return null // TODO: link to groupher home

  return (
    <footer className={s.wrapper}>
      {layout === FOOTER_LAYOUT.GROUP ? <GroupLayout /> : <SimpleLayout />}
      <PowerbyInfo />
    </footer>
  )
}
