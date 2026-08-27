import { DASHBOARD_LINK_TYPE } from '~/const/dashboard_link'
import { DEME_SOCIALS } from '~/const/social'
import { assetSrc } from '~/helper'
import useFooterLinks from '~/hooks/useFooterLinks'
import Img from '~/Img'
import { Link } from '~/platform'
import useCommunity from '~/stores/community/hooks'
import ImgFallback from '~/ui/ImgFallback'
import SocialList from '~/unit/SocialList'

import useSalon from './salon/group_layout'

export default function GroupLayout() {
  const s = useSalon()

  const { logo, desc, title } = useCommunity()
  const { links } = useFooterLinks()

  const groups = links.filter((item) => item.type === DASHBOARD_LINK_TYPE.GROUP)

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.brand}>
          <Img
            className={s.brandLogo}
            src={assetSrc(logo)}
            fallback={<ImgFallback title={title} />}
            noLazy
          />
          <p className={s.brandDesc}>{desc}</p>
          <div className='grow' />

          <SocialList size='medium' selected={DEME_SOCIALS} top={10} />
        </div>
        {groups.map((group) => {
          return (
            <div className={s.column} key={group.id}>
              <h3 className={s.title}>{group.title}</h3>
              <div className={s.body}>
                {group.links.map((item) => (
                  <Link key={item.id} href={item.url} navigation='document' className={s.link}>
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
