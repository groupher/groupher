import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import Input from '~/widgets/Input'
import ArrowLinker from '~/widgets/ArrowLinker'

import SectionLabel from '../SectionLabel'
import SearchEnginePreview from './SearchEnginePreview'

import useSEO from '../logic/useSEO'
import useSalon from '../salon/seo/open_graph'

/*
 see: https://mintlify.com/docs/settings/seo for details
*/

export default () => {
  const s = useSalon()
  const { seoEnable, ogSiteName, ogTitle, ogDescription, ogImage, ogUrl, edit, toggleSEO } =
    useSEO()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="允许搜索引擎收录"
        desc={
          <div className={s.enableDesc}>
            请确保你知道该操作的含义，
            <ArrowLinker href="https://developers.google.com/search/docs/crawling-indexing/block-indexing?hl=zh-cn">
              实现原理
            </ArrowLinker>
          </div>
        }
        addon={<ToggleSwitch checked={seoEnable} onChange={(v) => toggleSEO(v)} />}
      />
      {seoEnable && (
        <>
          <SearchEnginePreview />
          <label className={s.label}>og:site_name</label>
          <Input className={s.input} value={ogSiteName} onChange={(e) => edit(e, 'ogSiteName')} />
          <label className={s.label}>og:title</label>
          <Input className={s.input} value={ogTitle} onChange={(e) => edit(e, 'ogTitle')} />
          <label className={s.label}>og:description</label>
          <Input
            className={s.input}
            value={ogDescription}
            onChange={(e) => edit(e, 'ogDescription')}
          />
          <label className={s.label}>og:url</label>
          <Input className={s.input} value={ogUrl} onChange={(e) => edit(e, 'ogUrl')} />
          <label className={s.label}>og:image</label>
          <Input className={s.input} value={ogImage} onChange={(e) => edit(e, 'ogImage')} />
        </>
      )}
    </div>
  )
}
