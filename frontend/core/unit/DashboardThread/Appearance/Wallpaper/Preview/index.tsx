import SavingBar from '../../../SavingBar'
import useSalon from '../salon/preview'
import useLogic from '../useLogic'
import PreviewCard from './PreviewCard'
import Settings from './Settings'

export default function Preview() {
  const s = useSalon()
  const { isTouched, loading, rollbackWallpaper, onSave } = useLogic()

  return (
    <>
      <div className={s.previewCard}>
        <div className={s.previewLayout}>
          <div className={s.previewPanel}>
            <PreviewCard />
          </div>

          <div className={s.customizePanel}>
            <Settings />
          </div>
        </div>
      </div>

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
