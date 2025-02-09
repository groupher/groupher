import ImageSVG from '~/icons/Image'

import useSEO from '../../logic/useSEO'

import useSalon from '../../salon/seo/twitter_preview/summary_layout'

// example: https://elixirweekly.net/issues/339
// twitter:card = summary

export default () => {
  const { twUrl, twTitle, twDescription } = useSEO()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <label className={s.hint}>预览</label>
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
