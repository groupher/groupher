import { fmt2CompStyle } from '~/fmt'
import useWallpaper from '~/hooks/useWallpaper'

import useSalon, { cnMerge } from '../salon/preview_zone/auth_preview'

const getPreviewBackground = (background: string): string => {
  return background.replace(
    'url(/wallpaper/pattern/1.png) repeat,',
    'url(/wallpaper/pattern/1.png) left top / 260px auto repeat,',
  )
}

export default function AuthPreview() {
  const s = useSalon()
  const { background, effect } = useWallpaper()
  const filter = effect.replace(/^filter:\s*/, '').trim() || 'none'
  const previewStyle = {
    background: `var(--preview-wallpaper-bg, ${getPreviewBackground(background) || 'transparent'})`,
    ...fmt2CompStyle(effect),
    filter: `var(--preview-wallpaper-filter, ${filter})`,
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
