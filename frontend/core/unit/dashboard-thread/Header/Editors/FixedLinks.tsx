import { reject } from 'ramda'
import type { FC } from 'react'
import { ROUTE } from '~/const/route'
import useCommunity from '~/stores/community/hooks'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import type { TCommunityThread } from '~/spec'

import useSalon from '../../salon/header/editors/fixed_links'

type TProps = {
  isAboutLinkFold: boolean
}

const FixedLinks: FC<TProps> = ({ isAboutLinkFold }) => {
  const s = useSalon()
  const { slug, threads } = useCommunity()
  const { t } = useTrans()

  return (
    <div>
      <h3 className={s.note}>{t('dsb.header.fixed_links.title')}</h3>

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
              {t('dsb.header.fixed_links.more')}
              <ArrowSVG className={s.arrowIcon} />
            </h4>
            <div className={s.linkSlug}>{t('dsb.header.fixed_links.about')}</div>
          </div>
        ) : (
          <div className={s.item}>
            <h4 className={s.title}>{t('dsb.header.fixed_links.about')}</h4>
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
