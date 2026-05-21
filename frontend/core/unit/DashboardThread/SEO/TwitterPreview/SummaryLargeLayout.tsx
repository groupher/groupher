import useTrans from '~/hooks/useTrans'
import ImageSVG from '~/icons/Image'

import useSEO from '../../logic/useSEO'
import useSalon from '../salon/twitter_preview/summary_large_layout'

// example: https://www.sketch.com/blog/design-portfolio-mindsets/?utm_source=stephaniewalter.design&utm_medium=weeklylinks
// twitter:card = summary_large_image
export default function SummaryLargeLayout() {
  const s = useSalon()
  const { twUrl, twTitle, twDescription } = useSEO()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>{t('dsb.seo.twitter.preview')}</div>
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
