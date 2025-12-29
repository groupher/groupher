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
} & TActive

const Simple: FC<TProps> = ({ links, active }) => {
  const s = useSalon()

  const { edit } = useFooter()

  const [animateRef] = useAutoAnimate()

  const groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <button
      className={cn(s.wrapper, active && s.active)}
      onClick={() => edit(FOOTER_LAYOUT.SIMPLE, 'footerLayout')}
    >
      <CommunityBrand className='scale-95' />

      <div className={s.center} ref={animateRef}>
        {groupedLinks[groupKeys[0]].map((item) => (
          <a className={s.linkItem} key={item.title} href={item.link}>
            {item.title}
          </a>
        ))}
      </div>
      <div className={s.right}>
        <SocialList top={0} size='tiny' selected={DEME_SOCIALS} />
      </div>
    </button>
  )
}

export default Simple
