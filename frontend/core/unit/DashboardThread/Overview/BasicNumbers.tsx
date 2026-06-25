import { prettyNum } from '~/fmt'
import useTrans from '~/hooks/useTrans'
import NoteTip from '~/widgets/NoteTip'

import useOverview from '../logic/useOverview'
import useSalon from './salon/basic_numbers'

export default function BasicNumbers() {
  const s = useSalon()
  const { t } = useTrans()
  const { views, subscribersCount, postsCount, changelogsCount, docsCount } = useOverview()

  return (
    <div className={s.wrapper}>
      <div className={s.left}>
        <section className={s.section}>
          <div className={s.hint}>{t('dsb.overview.views')}</div>
          <div className={s.num}>{prettyNum(views)}</div>
        </section>
      </div>
      <div className={s.right}>
        <section className={s.section}>
          <div className={s.hint}>
            {t('dsb.overview.participants')}
            <NoteTip left={1} placement='top'>
              {t('dsb.overview.participants_hint')}
            </NoteTip>
          </div>
          <div className={s.num}>{prettyNum(subscribersCount)}</div>
        </section>

        <section className={s.section}>
          <div className={s.hint}>{t('dsb.overview.posts')}</div>
          <div className={s.num}>{prettyNum(postsCount)}</div>
        </section>

        <section className={s.section}>
          <div className={s.hint}>{t('dsb.overview.changelogs')}</div>
          <div className={s.num}>{prettyNum(changelogsCount)}</div>
        </section>

        <section className={s.section}>
          <div className={s.hint}>{t('dsb.overview.docs')}</div>
          <div className={s.num}>{prettyNum(docsCount)}</div>
        </section>
      </div>
    </div>
  )
}
