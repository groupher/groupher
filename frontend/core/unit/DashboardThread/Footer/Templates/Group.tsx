import { useAutoAnimate } from '@formkit/auto-animate/react'
import { keys } from 'ramda'
import type { FC } from 'react'

import { FOOTER_LAYOUT } from '~/const/layout'
import { DEME_SOCIALS } from '~/const/social'
import { groupByKey, sortByGroupIndex } from '~/helper'
import type { TActive, TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommunityBrand from '~/unit/CommunityBrand'
import SocialList from '~/unit/SocialList'

import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../../salon/footer/templates/group'

type TProps = {
  links: readonly TLinkItem[]
  /**
   * When used as a layout selector preview, disable nested interactive elements
   * (e.g., anchors) to avoid interactive-in-interactive a11y violations.
   */
  previewOnly?: boolean
} & TActive

const RADIO_NAME = 'footer-layout'

const Group: FC<TProps> = ({ links, active, previewOnly = true }) => {
  const s = useSalon()

  const { desc } = useCommunity()
  const { edit } = useFooter()
  const [animateRef] = useAutoAnimate()
  const [groupAnimateRef] = useAutoAnimate()

  const radioId = 'footer-layout-group'

  const groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <label htmlFor={radioId} className={cn(s.wrapper, active && s.active)}>
      <input
        id={radioId}
        type='radio'
        name={RADIO_NAME}
        checked={active}
        onChange={() => edit(FOOTER_LAYOUT.GROUP, 'footerLayout')}
        className='sr-only'
      />

      <div className={s.left}>
        <CommunityBrand className='-ml-1 scale-90' />
        <div className={s.desc}>{desc}</div>
        <div className='grow' />
        <SocialList left={-2} size='tiny' selected={DEME_SOCIALS} />
      </div>

      <div className={s.right} ref={groupAnimateRef}>
        {groupKeys.map((groupTitle: string) => {
          const curGroupLinks = groupedLinks[groupTitle]

          return (
            <div className={s.center} key={groupTitle} ref={animateRef}>
              <div className={s.groupTitle}>{groupTitle}</div>

              {curGroupLinks.map((item) =>
                previewOnly ? (
                  <span key={item.title} className={s.linkItem}>
                    {item.title}
                  </span>
                ) : (
                  <a key={item.title} href={item.link} className={s.linkItem}>
                    {item.title}
                  </a>
                ),
              )}
            </div>
          )
        })}
      </div>
    </label>
  )
}

export default Group
