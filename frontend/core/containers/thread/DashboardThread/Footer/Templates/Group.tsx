import { useAutoAnimate } from '@formkit/auto-animate/react'
import { keys } from 'ramda'
import type { FC } from 'react'
import { FOOTER_LAYOUT } from '~/const/layout'
import { DEME_SOCIALS } from '~/const/social'
import { groupByKey, sortByGroupIndex } from '~/helper'
import useCommunity from '~/hooks/useCommunity'
import type { TActive, TLinkItem } from '~/spec'

import CommunityBrand from '~/widgets/CommunityBrand'
import SocialList from '~/widgets/SocialList'

import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../../salon/footer/templates/group'

type TProps = {
  links: readonly TLinkItem[]
} & TActive

const Group: FC<TProps> = ({ links, active }) => {
  const s = useSalon()

  const { desc } = useCommunity()
  const { edit } = useFooter()
  const [animateRef] = useAutoAnimate()
  const [groupAnimateRef] = useAutoAnimate()

  const groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <button
      className={cn(s.wrapper, active && s.active)}
      onClick={() => edit(FOOTER_LAYOUT.GROUP, 'footerLayout')}
    >
      <div className={s.left}>
        <CommunityBrand className='-ml-1 scale-90' />
        <div className={s.desc}>{desc}</div>
        <SocialList top={20} left={-5} size='tiny' selected={DEME_SOCIALS} />
      </div>

      <div className={s.right} ref={groupAnimateRef}>
        {groupKeys.map((groupTitle: string) => {
          const curGroupLinks = groupedLinks[groupTitle]

          return (
            <div className={s.center} key={groupTitle} ref={animateRef}>
              <div className={s.groupTitle}>{groupTitle}</div>

              {curGroupLinks.map((item) => (
                <a key={item.title} href={item.link} className={s.linkItem}>
                  {item.title}
                </a>
              ))}
            </div>
          )
        })}
      </div>
    </button>
  )
}

export default Group
