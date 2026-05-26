import { LOCALE } from '~/const/i18n'
import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useMount from '~/hooks/useMount'
import useTrans from '~/hooks/useTrans'
import ThemeSwitchPreview from '~/widgets/ThemeSwitch/Preview'

import SectionLabel from '../../SectionLabel'
import CustomGradientEditor from './BuildIn/CustomGradientEditor'
import GradientGroup from './BuildIn/GradientGroup'
import PictureGroup from './BuildIn/PictureGroup'
import { TAB, TAB_OPTIONS } from './constant'
import PreviewCard from './PreviewCard'
import useSalon from './salon'
import useEditorSalon from './salon/editor'
import UploadPic from './UploadPic'
import useLogic from './useLogic'

export default function Wallpaper() {
  const s = useSalon()
  const editor = useEditorSalon()
  const { t, locale } = useTrans()
  const { tab, changeTab, initRollback, getWallpaper, isTouched } = useLogic()
  const { type } = getWallpaper()

  useMount(initRollback)

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.wallpaper.title')}
        desc={t('dsb.appearance.wallpaper.desc')}
        addon={<ThemeSwitchPreview />}
        touched={isTouched}
        width='96%'
      />

      <PreviewCard />

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
      </div>
    </div>
  )
}
