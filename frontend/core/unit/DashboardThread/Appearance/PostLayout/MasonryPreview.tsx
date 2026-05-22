import useSalon, { cnMerge } from './salon'
import type { TPreviewProps } from './spec'

export default function MasonryPreview({ isActive, compact }: TPreviewProps) {
  const s = useSalon({ compact })

  return (
    <div className={cnMerge(s.masonryBlock, isActive && s.blockActive)}>
      <div className={s.masonryGrid}>
        <div className={s.masonryCol}>
          <div className={cnMerge(s.bar, s.masonryTopBar)} />
          <div className={cnMerge(s.bar, s.masonryMainCard)} />
          <div className={cnMerge(s.bar, s.masonryBottomCard)} />
        </div>

        <div className={s.masonryCol}>
          <div className={cnMerge(s.bar, s.masonrySideTop)} />
          <div className={cnMerge(s.bar, s.masonrySideMain)} />
          <div className={cnMerge(s.bar, s.masonrySideBottom)} />
        </div>
      </div>
    </div>
  )
}
