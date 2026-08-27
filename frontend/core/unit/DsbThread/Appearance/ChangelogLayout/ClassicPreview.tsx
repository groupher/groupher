import useSalon, { cnMerge } from './salon'

type TProps = {
  isActive: boolean
}

export default function ClassicPreview({ isActive }: TProps) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.classicList}>
          <div className={s.classicEntry}>
            <div className={s.classicCover} />
            <div className={s.classicText}>
              <div className={s.classicTitle} />
              <div className={s.classicBodyWide} />
              <div className={s.classicBodyNarrow} />
            </div>
          </div>

          <div className={s.classicEntry}>
            <div className={s.classicCover} />
            <div className={s.classicText}>
              <div className={s.classicTitle} />
              <div className={s.classicBodyNarrow} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
