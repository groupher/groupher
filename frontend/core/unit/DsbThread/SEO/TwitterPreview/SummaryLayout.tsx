import useTrans from '~/hooks/useTrans'
import ImageSVG from '~/icons/Image'

import useSEO from '../../logic/useSEO'
import useSalon from '../salon/twitter_preview/summary_layout'

// example: https://elixirweekly.net/issues/339
// twitter:card = summary

export default function SummaryLayout() {
  const { twUrl, twTitle, twDescription } = useSEO()
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>{t('dsb.portal.widgets.preview')}</div>
      <div className={s.coverWrapper}>
        <ImageSVG className={s.holdImg} />
      </div>
      <div className={s.content}>
        <div className={s.url}>{twUrl || '--'}</div>
        <h3 className={s.title}>{twTitle || '--'}</h3>
        <p className={s.desc}>{twDescription || '--'}</p>
      </div>
    </div>
  )
}
