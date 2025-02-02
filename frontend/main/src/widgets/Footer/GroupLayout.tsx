import { keys } from 'ramda'
import Link from 'next/link'

import { DEME_SOCIALS } from '~/const/social'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import useFooterLinks from '~/hooks/useFooterLinks'

import { assetSrc, sortByIndex, groupByKey } from '~/helper'

import Img from '~/Img'
import SocialList from '~/widgets/SocialList'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon from './salon/group_layout'

export default () => {
  const s = useSalon()

  const { logo, desc, title } = useViewingCommunity()
  const { links } = useFooterLinks()

  // @ts-ignore
  const groupedLinks = groupByKey(sortByIndex(links, 'groupIndex'), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.brand}>
          <Img
            className={s.brandLogo}
            src={assetSrc(logo)}
            fallback={<ImgFallback size={6} left={-0.5} title={title} />}
            noLazy
          />
          <p className={s.brandDesc}>{desc}</p>
          <div className="grow" />

          <SocialList size="medium" selected={DEME_SOCIALS} top={10} />
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
