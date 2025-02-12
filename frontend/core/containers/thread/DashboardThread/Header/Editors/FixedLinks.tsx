import type { FC } from 'react'
import { reject } from 'ramda'

import type { TCommunityThread } from '~/spec'
import { ROUTE } from '~/const/route'

import useViewingCommunity from '~/hooks/useViewingCommunity'
import ArrowSVG from '~/icons/ArrowSimple'

import useSalon from '../../salon/header/editors/fixed_links'

type TProps = {
  isAboutLinkFold: boolean
}

const FixedLinks: FC<TProps> = ({ isAboutLinkFold }) => {
  const s = useSalon()
  const { slug, threads } = useViewingCommunity()

  return (
    <div>
      <h3 className={s.note}>固定链接:</h3>

      <div className={s.items}>
        {reject((t: TCommunityThread) => t.slug === ROUTE.ABOUT, threads).map(
          (item: TCommunityThread) => (
            <div key={item.slug} className={s.item}>
              <h4 className={s.title}>{item.title}</h4>
              <div className={s.linkSlug}>
                /{slug}/{item.slug}
              </div>
            </div>
          ),
        )}

        {isAboutLinkFold ? (
          <div className={s.item}>
            <h4 className={s.title}>
              更多
              <ArrowSVG className={s.arrowIcon} />
            </h4>
            <div className={s.linkSlug}>关于</div>
          </div>
        ) : (
          <div className={s.item}>
            <h4 className={s.title}>关于</h4>
            <div className={s.linkSlug}>
              /{slug}/{ROUTE.ABOUT}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FixedLinks
