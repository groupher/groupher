import useSalon, { cnMerge } from './salon'

type TProps = {
  isActive: boolean
}

export default function MinimalPreview({ isActive }: TProps) {
  const s = useSalon()

  return (
    <div className={cnMerge(s.block, isActive && s.blockActive)}>
      <div className={s.frame}>
        <div className={s.minimalList}>
          <div className={s.minimalListInner}>
            <div className={s.minimalEntry}>
              <div className={s.minimalHeader}>
                <div className={s.minimalMeta} />
                <div className={s.minimalMain}>
                  <div className={s.minimalText}>
                    <div className={s.minimalTitle} />
                    <div className={s.minimalBodyWide} />
                    <div className={s.minimalBodyNarrow} />
                  </div>
                  <div className={s.minimalThumbRow}>
                    <div className={s.minimalThumb} />
                    <div className={s.minimalThumb} />
                  </div>
                </div>
              </div>
            </div>

            <div className={s.minimalEntry}>
              <div className={s.minimalHeader}>
                <div className={s.minimalMeta} />
                <div className={s.minimalMain}>
                  <div className={s.minimalText}>
                    <div className={s.minimalTitle} />
                    <div className={s.minimalBodyNarrow} />
                    <div className={s.minimalBodyWide} />
                    <div className={s.minimalBodyTiny} />
                  </div>
                  <div className={s.minimalThumbRow}>
                    <div className={s.minimalThumb} />
                    <div className={s.minimalThumb} />
                  </div>
                </div>
              </div>
            </div>

            <div className={s.minimalEntry}>
              <div className={s.minimalHeader}>
                <div className={s.minimalMeta} />
                <div className={s.minimalMain}>
                  <div className={s.minimalTitle} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
