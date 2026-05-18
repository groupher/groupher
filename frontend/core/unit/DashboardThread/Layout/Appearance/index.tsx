import useTrans from '~/hooks/useTrans'
import ThemeSectionSelector from '~/widgets/ThemeSectionSelector'

import useSalon from '../../salon/layout/details_panel'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import DetailsPanel from './DetailsPanel'
import useAppearance from './hooks'
import PresetList from './PresetList'

export default function Appearance() {
  const { t } = useTrans()
  const s = useSalon()
  const {
    activePreset,
    selectedOverrides,
    selectedPageBgDraft,
    pageBgDraft,
    setPageBgDraft,
    isTouched,
    isLightTheme,
    primaryCustomColor,
    selectPreset,
    saveAppearance,
    cancelAppearance,
    editField,
  } = useAppearance()

  return (
    <section>
      <SectionLabel
        title={t('dsb.layout.appearance.title')}
        desc={t('dsb.layout.appearance.desc')}
        addon={<ThemeSectionSelector />}
      />

      <PresetList activePreset={activePreset} onSelect={selectPreset} />

      <DetailsPanel
        selectedOverrides={selectedOverrides}
        selectedPageBgDraft={selectedPageBgDraft}
        pageBgDraft={pageBgDraft}
        setPageBgDraft={setPageBgDraft}
        primaryCustomColor={primaryCustomColor}
        isLightTheme={isLightTheme}
        editField={editField}
      />

      {isTouched && (
        <div className={s.savingWrapper}>
          <SavingBar isTouched onCancel={cancelAppearance} onConfirm={saveAppearance} />
        </div>
      )}
    </section>
  )
}
