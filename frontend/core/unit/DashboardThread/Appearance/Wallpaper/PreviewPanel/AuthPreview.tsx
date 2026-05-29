import WallpaperRenderer from '~/widgets/WallpaperRenderer'

import useSalon, { cnMerge } from '../salon/preview_zone/auth_preview'

export default function AuthPreview() {
  const s = useSalon()

  return (
    <div className={s.realPreview}>
      <WallpaperRenderer className={s.previewImage} patternSize='260px auto' textureScale={0.72} />
      <div className={s.authCard}>
        <div className={cnMerge(s.bar, s.authTitle)} />
        <div className={s.authInput} />
        <div className={s.authInput} />
        <div className={s.authButton} />
      </div>
    </div>
  )
}
