import useSEO from '../logic/useSEO'

import useSalon from '../salon/seo/search_engine_preview'

export default () => {
  const { ogSiteName, ogDescription, ogUrl } = useSEO()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>预览</div>
      <div className={s.url}>{ogUrl || '--'}</div>
      <h3 className={s.title}>{ogSiteName || '--'} </h3>
      <p className={s.desc}>{ogDescription || '--'} </p>
    </div>
  )
}
