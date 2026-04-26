import Link from 'next/link'
import { keys } from 'ramda'

import { DEME_SOCIALS } from '~/const/social'
import { groupByKey, sortByGroupIndex } from '~/helper'
import useFooterLinks from '~/hooks/useFooterLinks'
import type { TLinkItem } from '~/spec'
import SocialList from '~/unit/SocialList'

import useSalon from './salon/simple_layout'

export default function SimpleLayout() {
  const s = useSalon()
  const { links } = useFooterLinks()

  const groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
  const groupKeys = keys(groupedLinks)

  const firstGroup = groupKeys[0]
  const firstGroupLinks = firstGroup ? groupedLinks[firstGroup] : []

  return (
    <div className={s.wrapper}>
      <Link className={s.brandLink} href='/'>
        Groupher
      </Link>
      <div className={s.linksInfo}>
        {firstGroupLinks.map((item: TLinkItem) => (
          <Link
            className={s.linkItem}
            key={`${item.groupIndex ?? 0}-${item.index}`}
            href={item.link}
          >
            {item.title}
          </Link>
        ))}
      </div>
      <SocialList selected={DEME_SOCIALS} />
    </div>
  )
}
