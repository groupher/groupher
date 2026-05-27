import { fmt2CompStyle } from '~/fmt'
import useWallpaper from '~/hooks/useWallpaper'

import useSalon, { cnMerge } from '../salon/preview_zone/auth_preview'

export default function AuthPreview() {
  const s = useSalon()
  const { background, effect } = useWallpaper()
  const previewStyle = {
    background,
    ...fmt2CompStyle(effect),
    ...(background.includes('/wallpaper/pattern/') ? { backgroundSize: '260px auto, cover' } : {}),
  }

  return (
    <div className={s.realPreview}>
      <div className={s.previewImage} style={previewStyle} />
      <div className={s.authCard}>
        <div className={cnMerge(s.bar, s.authTitle)} />
        <div className={s.authInput} />
        <div className={s.authButton} />
      </div>
    </div>
  )
}
