import SavingBar from '../../../SavingBar'
import useSalon from '../salon/preview_panel'
import TuningPanel from '../TuningPanel'
import useLogic from '../useLogic'
import AuthPreview from './AuthPreview'
import GlobalPreview from './GlobalPreview'

export default function PreviewPanel() {
  const s = useSalon()
  const { isTouched, loading, rollbackWallpaper, onSave } = useLogic()

  return (
    <>
      <div className={s.wrapper}>
        <div className={s.previewLayout}>
          <div className={s.previewPanel}>
            <GlobalPreview />
          </div>

          <div className={s.previewPanel}>
            <AuthPreview />
          </div>
        </div>
      </div>

      <TuningPanel />

      <SavingBar
        isTouched={isTouched}
        loading={loading}
        onCancel={rollbackWallpaper}
        onConfirm={onSave}
        top={6}
      />
    </>
  )
}
