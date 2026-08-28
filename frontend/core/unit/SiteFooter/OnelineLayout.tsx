import { DEME_SOCIALS } from '~/const/social'
import useFooterLinks from '~/hooks/useFooterLinks'
import { Link } from '~/platform'
import SocialList from '~/unit/SocialList'

import useSalon from './salon/oneline_layout'

export default function OnelineLayout() {
  const s = useSalon()
  const { onelineLinks } = useFooterLinks()

  return (
    <div className={s.wrapper}>
      <Link className={s.brandLink} href='/' navigation='document'>
        Groupher
      </Link>
      <div className={s.linksInfo}>
        {onelineLinks.map((item) => (
          <Link className={s.linkItem} key={item.id} href={item.url} navigation='document'>
            {item.title}
          </Link>
        ))}
      </div>
      <SocialList selected={DEME_SOCIALS} />
    </div>
  )
}
