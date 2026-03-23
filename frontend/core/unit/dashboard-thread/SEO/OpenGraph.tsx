import useTrans from '~/hooks/useTrans'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import Input from '~/widgets/Input'
import useSEO from '../logic/useSEO'
import SectionLabel from '../SectionLabel'
import useSalon from '../salon/seo/open_graph'
import SearchEnginePreview from './SearchEnginePreview'

/*
 see: https://mintlify.com/docs/settings/seo for details
*/

export default function OpenGraph() {
  const s = useSalon()
  const { t } = useTrans()
  const { seoEnable, ogSiteName, ogTitle, ogDescription, ogImage, ogUrl, edit, toggleSEO } =
    useSEO()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.seo.open_graph.title')}
        detailText={t('dsb.seo.open_graph.detail')}
        desc={t('dsb.seo.open_graph.desc')}
        onDetailClick={() => {
          window.open(
            'https://developers.google.com/search/docs/crawling-indexing/block-indexing?hl=zh-cn',
            '_blank',
            'noopener,noreferrer',
          )
        }}
        addon={<ToggleSwitch checked={seoEnable} onChange={(v) => toggleSEO(v)} />}
      />
      {seoEnable && (
        <>
          <SearchEnginePreview />
          <label className={s.label} htmlFor='og-site-name'>
            og:site_name
          </label>
          <Input
            id='og-site-name'
            className={s.input}
            value={ogSiteName}
            onChange={(e) => edit(e, 'ogSiteName')}
          />
          <label className={s.label} htmlFor='og-title'>
            og:title
          </label>
          <Input
            id='og-title'
            className={s.input}
            value={ogTitle}
            onChange={(e) => edit(e, 'ogTitle')}
          />
          <label className={s.label} htmlFor='og-description'>
            og:description
          </label>
          <Input
            id='og-description'
            className={s.input}
            value={ogDescription}
            onChange={(e) => edit(e, 'ogDescription')}
          />
          <label className={s.label} htmlFor='og-url'>
            og:url
          </label>
          <Input id='og-url' className={s.input} value={ogUrl} onChange={(e) => edit(e, 'ogUrl')} />
          <label className={s.label} htmlFor='og-image'>
            og:image
          </label>
          <Input
            id='og-image'
            className={s.input}
            value={ogImage}
            onChange={(e) => edit(e, 'ogImage')}
          />
        </>
      )}
    </div>
  )
}
