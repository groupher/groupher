import useTrans from '~/hooks/useTrans'

import useSEO from '../logic/useSEO'
import useSalon from './salon/search_engine_preview'

export default function SearchEnginePreview() {
  const { ogSiteName, ogDescription, ogUrl } = useSEO()
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.hint}>{t('dsb.portal.widgets.preview')}</div>
      <div className={s.url}>{ogUrl || '--'}</div>
      <h3 className={s.title}>{ogSiteName || '--'} </h3>
      <p className={s.desc}>{ogDescription || '--'} </p>
    </div>
  )
}
