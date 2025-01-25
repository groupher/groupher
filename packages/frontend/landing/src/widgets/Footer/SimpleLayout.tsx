import Link from 'next/link'
import { keys } from 'ramda'

import type { TLinkItem } from '~/spec'
import useFooterLinks from '~/hooks/useFooterLinks'
import { DEME_SOCIALS } from '~/const/social'

import { sortByIndex, groupByKey } from '~/helper'

import SocialList from '~/widgets/SocialList'

import useSalon from './salon/simple_layout'

export default () => {
  const s = useSalon()
  const { links } = useFooterLinks()

  // @ts-ignore
  const groupedLinks = groupByKey(sortByIndex(links, 'groupIndex'), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <div className={s.wrapper}>
      <Link className={s.brandLink} href="/">
        Groupher
      </Link>
      <div className={s.linksInfo}>
        {groupedLinks[groupKeys[0]].map((item: TLinkItem) => (
          <Link className={s.linkItem} key={item.index} href={item.link}>
            {item.title}
          </Link>
        ))}
      </div>
      <SocialList selected={DEME_SOCIALS} />
    </div>
  )
}
