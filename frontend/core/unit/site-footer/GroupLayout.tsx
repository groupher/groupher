import Link from 'next/link'
import { keys } from 'ramda'

import { DEME_SOCIALS } from '~/const/social'
import { assetSrc, groupByKey, sortByGroupIndex } from '~/helper'
import useCommunity from '~/stores/community/hooks'
import useFooterLinks from '~/hooks/useFooterLinks'

import Img from '~/Img'
import ImgFallback from '~/widgets/ImgFallback'
import SocialList from '~/unit/social-list'

import useSalon from './salon/group_layout'

export default function GroupLayout() {
  const s = useSalon()

  const { logo, desc, title } = useCommunity()
  const { links } = useFooterLinks()

  const groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
  const groupKeys = keys(groupedLinks)

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
        {groupKeys.map((groupTitle: string) => {
          const curGroupLinks = groupedLinks[groupTitle]

          return (
            <div className={s.column} key={groupTitle}>
              <h3 className={s.title}>{groupTitle}</h3>
              <div className={s.body}>
                {curGroupLinks.map((item) => (
                  <Link key={item.index} href={item.link} className={s.link}>
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
