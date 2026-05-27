import SavingBar from '../../../SavingBar'
import useSalon from '../salon/preview_zone'
import type { TTab } from '../spec'
import TuningZone from '../TuningZone'
import useLogic from '../useLogic'
import AuthPreview from './AuthPreview'
import GlobalPreview from './GlobalPreview'

type TProps = {
  tab: TTab
}

export default function PreviewZone({ tab }: TProps) {
  const s = useSalon()
  const { isTouched, loading, rollbackWallpaper, onSave } = useLogic()

  return (
    <>
      <div className={s.previewCard}>
        <div className={s.previewLayout}>
          <div className={s.previewPanel}>
            <GlobalPreview />
          </div>

          <div className={s.previewPanel}>
            <AuthPreview />
          </div>
        </div>
      </div>

      <div className={s.settingsCard}>
        <TuningZone tab={tab} />
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
