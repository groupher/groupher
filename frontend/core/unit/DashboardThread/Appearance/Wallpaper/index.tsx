import { PAGE_BG_CSS_KEY } from '~/const/colors'
import { LOCALE } from '~/const/i18n'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { blurRGB } from '~/fmt'
import useCSSVar from '~/hooks/useCssVar'
import useGaussBlur from '~/hooks/useGaussBlur'
import useMount from '~/hooks/useMount'
import useTrans from '~/hooks/useTrans'
import useWallpaper from '~/hooks/useWallpaper'

import SectionLabel from '../../SectionLabel'
import CustomGradientEditor from './BuildIn/CustomGradientEditor'
import GradientGroup from './BuildIn/GradientGroup'
import PictureGroup from './BuildIn/PictureGroup'
import { TAB, TAB_OPTIONS } from './constant'
import EffectsPanel from './EffectsPanel'
import Footer from './Footer'
import useSalon, { cnMerge } from './salon'
import useEditorSalon from './salon/editor'
import ThemeModeSelector from './ThemeModeSelector'
import UploadPic from './UploadPic'
import useLogic from './useLogic'

export default function Wallpaper() {
  const s = useSalon()
  const editor = useEditorSalon()
  const { t, locale } = useTrans()
  const { tab, changeTab, initRollback, getWallpaper } = useLogic()
  const { type } = getWallpaper()

  const gaussBlur = useGaussBlur()
  const { background } = useWallpaper()
  const pageBg = useCSSVar(PAGE_BG_CSS_KEY, [gaussBlur], { selector: 'main' })

  const bgColor = `${blurRGB(pageBg, gaussBlur)}`

  useMount(initRollback)

  return (
    <div className={s.wrapper}>
      <div className={s.themeSwitch}>
        <ThemeModeSelector />
      </div>

      <SectionLabel
        title={t('dsb.appearance.wallpaper.title')}
        desc={t('dsb.appearance.wallpaper.desc')}
        width='96%'
      />

      <div className={s.previewCard}>
        <div className={s.previewLayout}>
          <div className={s.previewPanel}>
            <div className={s.realPreview}>
              <div className={s.previewImage} style={{ background }} />
              <div className={s.content} style={{ background: bgColor }}>
                <div className={s.contentTop}>
                  <div className={cnMerge(s.bar, s.titleBar)} />
                  <div className={cnMerge(s.bar, s.wideBar)} />
                  <div className={cnMerge(s.bar, s.midBar)} />
                  <div className={cnMerge(s.bar, s.longBar)} />
                  <div className={cnMerge(s.bar, s.shortBar)} />
                  <div className={cnMerge(s.bar, s.dimBar)} />
                </div>
                <div className={s.contentBottom}>
                  <div className={cnMerge(s.bar, s.footerShort)} />
                  <div className={cnMerge(s.bar, s.footerWide)} />
                </div>
              </div>
            </div>
          </div>

          <div className={s.customizePanel}>
            <EffectsPanel />
          </div>
        </div>
      </div>

      <div className={editor.wrapper}>
        <div className={editor.banner}>
          {TAB_OPTIONS.map((item) => (
            <button
              type='button'
              key={item.slug}
              className={editor.tabItem(tab === item.slug)}
              onClick={() => changeTab(item.slug)}
            >
              <span>{locale === LOCALE.ZH ? item.labelZh : item.labelEn}</span>
              {tab === item.slug && <span className={editor.tabIndicator} />}
            </button>
          ))}
        </div>

        <div className={editor.content}>
          {tab === TAB.PICTURES && <PictureGroup />}
          {tab === TAB.GRADIENT && (
            <>
              <GradientGroup />
              {type === WALLPAPER_TYPE.CUSTOM_GRADIENT && <CustomGradientEditor />}
            </>
          )}
          {tab === TAB.UPLOAD && <UploadPic />}
        </div>

        <Footer />
      </div>
    </div>
  )
}
