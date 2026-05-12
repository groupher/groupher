import Link from 'next/link'

import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import { DEME_SOCIALS } from '~/const/social'
import useFooterLinks from '~/hooks/useFooterLinks'
import SocialList from '~/unit/SocialList'

import useSalon from './salon/simple_layout'

export default function SimpleLayout() {
  const s = useSalon()
  const { links } = useFooterLinks()

  const firstGroupLinks = links.find((item) => item.type === DASHBOARD_LINK_TYPE.GROUP)?.links || []

  return (
    <div className={s.wrapper}>
      <Link className={s.brandLink} href='/'>
        Groupher
      </Link>
      <div className={s.linksInfo}>
        {firstGroupLinks.map((item) => (
          <Link className={s.linkItem} key={item.id} href={item.url}>
            {item.title}
          </Link>
        ))}
      </div>
      <SocialList selected={DEME_SOCIALS} />
    </div>
  )
}
