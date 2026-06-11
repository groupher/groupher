import useTrans from '~/hooks/useTrans'
import type { TWallpaperContentShadow } from '~/stores/wallpaper/spec'
import ToggleField from '~/widgets/TuningFields/ToggleField'

import useSalon from '../../salon/detail_panel/content'
import GroupTitle from '../GroupTitle'

type Props = {
  contentShadow: TWallpaperContentShadow
  onToggleShadow: (enabled: boolean) => void
}

export default function Content({ contentShadow, onToggleShadow }: Props) {
  const { t } = useTrans()
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GroupTitle>{t('dsb.appearance.wallpaper.editor.content')}</GroupTitle>

      <div className={s.items}>
        <ToggleField
          label={t('dsb.appearance.wallpaper.editor.shadow')}
          checked={contentShadow.enabled}
          onChange={onToggleShadow}
        />
      </div>
    </section>
  )
}
