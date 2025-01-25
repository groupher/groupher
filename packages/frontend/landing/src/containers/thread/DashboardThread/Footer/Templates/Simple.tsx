import type { FC } from 'react'
import { keys } from 'ramda'
import { useAutoAnimate } from '@formkit/auto-animate/react'

import type { TActive, TLinkItem } from '~/spec'
import { sortByIndex, groupByKey } from '~/helper'

import { FOOTER_LAYOUT } from '~/const/layout'
import { DEME_SOCIALS } from '~/const/social'

import CommunityBrand from '~/widgets/CommunityBrand'
import SocialList from '~/widgets/SocialList'

import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../../salon/footer/templates/simple'

type TProps = {
  links: TLinkItem[]
} & TActive

const Simple: FC<TProps> = ({ links, active }) => {
  const s = useSalon()

  const { edit } = useFooter()

  const [animateRef] = useAutoAnimate()

  // @ts-ignore
  const groupedLinks = groupByKey(sortByIndex(links, 'groupIndex'), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <div
      className={cn(s.wrapper, active && s.active)}
      onClick={() => edit(FOOTER_LAYOUT.SIMPLE, 'footerLayout')}
    >
      <CommunityBrand className="scale-95" />

      <div className={s.center} ref={animateRef}>
        {groupedLinks[groupKeys[0]].map((item) => (
          <a className={s.linkItem} key={item.title} href={item.link}>
            {item.title}
          </a>
        ))}
      </div>
      <div className={s.right}>
        <SocialList top={0} size="tiny" selected={DEME_SOCIALS} />
      </div>
    </div>
  )
}

export default Simple
