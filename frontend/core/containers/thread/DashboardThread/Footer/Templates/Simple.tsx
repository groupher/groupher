import { useAutoAnimate } from '@formkit/auto-animate/react'
import { keys } from 'ramda'
import type { FC } from 'react'

import { FOOTER_LAYOUT } from '~/const/layout'
import { DEME_SOCIALS } from '~/const/social'
import { groupByKey, sortByGroupIndex } from '~/helper'
import type { TActive, TLinkItem } from '~/spec'

import CommunityBrand from '~/widgets/CommunityBrand'
import SocialList from '~/widgets/SocialList'

import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../../salon/footer/templates/simple'

type TProps = {
  links: readonly TLinkItem[]
  /**
   * When used as a layout selector preview, disable nested interactive elements
   * (e.g., anchors) to avoid interactive-in-interactive a11y violations.
   */
  previewOnly?: boolean
} & TActive

const RADIO_NAME = 'footer-layout'

const Simple: FC<TProps> = ({ links, active, previewOnly = true }) => {
  const s = useSalon()
  const { edit } = useFooter()
  const [animateRef] = useAutoAnimate()

  const radioId = 'footer-layout-simple'

  const groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
  const groupKeys = keys(groupedLinks)
  const firstGroupKey = groupKeys[0]
  const firstGroupLinks = firstGroupKey ? groupedLinks[firstGroupKey] : []

  return (
    <label htmlFor={radioId} className={cn(s.wrapper, active && s.active)}>
      <input
        id={radioId}
        type='radio'
        name={RADIO_NAME}
        checked={active}
        onChange={() => edit(FOOTER_LAYOUT.SIMPLE, 'footerLayout')}
        className='sr-only'
      />

      <CommunityBrand className='scale-95' />

      <div className={s.center} ref={animateRef}>
        {firstGroupLinks.map((item) =>
          previewOnly ? (
            <span className={s.linkItem} key={item.title}>
              {item.title}
            </span>
          ) : (
            <a className={s.linkItem} key={item.title} href={item.link}>
              {item.title}
            </a>
          ),
        )}
      </div>

      <div className={s.right}>
        <SocialList top={0} size='tiny' selected={DEME_SOCIALS} />
      </div>
    </label>
  )
}

export default Simple
