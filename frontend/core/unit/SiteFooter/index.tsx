'use client'

/*
 *
 * Footer
 *
 */

import { FOOTER_LAYOUT } from '~/const/layout'
import useFooterLinks from '~/hooks/useFooterLinks'
import type { TContainerMetric } from '~/hooks/useTwBelt/spec'
import useCommunity from '~/stores/community/hooks'

import GroupLayout from './GroupLayout'
import OnelineLayout from './OnelineLayout'
import PowerbyInfo from './PowerbyInfo'
import useSalon from './salon'

type TProps = {
  containerMetric?: TContainerMetric | null
}

export default function Footer({ containerMetric = null }: TProps) {
  const s = useSalon({ containerMetric })

  const { slug } = useCommunity()
  const { layout } = useFooterLinks()

  if (!slug) return null // TODO: link to groupher home

  return (
    <footer className={s.wrapper}>
      <div className={s.inner}>
        {layout === FOOTER_LAYOUT.GROUP ? <GroupLayout /> : <OnelineLayout />}
        <PowerbyInfo />
      </div>
    </footer>
  )
}
