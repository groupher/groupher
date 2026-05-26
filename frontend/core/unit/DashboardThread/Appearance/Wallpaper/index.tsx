import useMount from '~/hooks/useMount'
import useTrans from '~/hooks/useTrans'
import Tabs from '~/widgets/Switcher/Tabs'
import ThemeSwitchPreview from '~/widgets/ThemeSwitch/Preview'

import SectionLabel from '../../SectionLabel'
import { TAB, TAB_OPTIONS } from './constant'
import GradientTab from './GradientTab'
import PicturesTab from './PicturesTab'
import Preview from './Preview'
import useSalon from './salon'
import UploadTab from './UploadTab'
import useLogic from './useLogic'

export default function Wallpaper() {
  const s = useSalon()
  const { t } = useTrans()
  const { tab, changeTab, initRollback, isTouched } = useLogic()

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

      <Preview />

      <div className={s.editor}>
        <div className={s.editorTabs}>
          <Tabs
            items={TAB_OPTIONS}
            activeKey={tab}
            onChange={(key) => changeTab(key as typeof tab)}
          />
        </div>

        <div className={s.editorContent}>
          {tab === TAB.PICTURES && <PicturesTab />}
          {tab === TAB.GRADIENT && <GradientTab />}
          {tab === TAB.UPLOAD && <UploadTab />}
        </div>
      </div>
    </div>
  )
}
