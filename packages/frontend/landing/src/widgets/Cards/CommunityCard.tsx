/*
 * cards for job MasonryCards view
 */
import type { FC } from 'react'
import Link from 'next/link'

import type { TCommunity } from '~/spec'
import { cutRest } from '~/fmt'

import UserSVG from '~/icons/User'

import Img from '~/Img'
import DotDivider from '~/widgets/DotDivider'

import useSalon from './salon/community_card'

type TProps = {
  item: TCommunity
}

const CommunityCard: FC<TProps> = ({ item: { logo, title, slug, desc } }) => {
  const s = useSalon()

  return (
    <div key={slug} className={s.wrapper}>
      <div className={s.header}>
        <Img src={logo} className={s.communityLogo} />
        <div className={s.info}>
          <div className={s.title}>{title}</div>
          <div className={s.subInfo}>
            <Link href={`/${slug}`} prefetch={false} className={s.rawLink}>
              {slug}
            </Link>
            <DotDivider className="mx-1.5" />
            <div className={s.subsInfo}>
              <UserSVG className={s.userIcon} />
              <div className={s.userCount}>74</div>
            </div>
          </div>
        </div>
      </div>
      <div className={s.desc}>{cutRest(desc, 50)}</div>
    </div>
  )
}

export default CommunityCard
