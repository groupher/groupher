import useTrans from '~/hooks/useTrans'
import ToggleField from '~/widgets/TuningFields/ToggleField'

import useSalon from '../../salon/detail_panel/content'
import GroupTitle from '../GroupTitle'

type Props = {
  hasShadow: boolean
  onToggleShadow: (hasShadow: boolean) => void
}

export default function Content({ hasShadow, onToggleShadow }: Props) {
  const { t } = useTrans()
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GroupTitle>{t('dsb.appearance.wallpaper.editor.content')}</GroupTitle>

      <div className={s.items}>
        <ToggleField
          label={t('dsb.appearance.wallpaper.editor.shadow')}
          checked={hasShadow}
          onChange={onToggleShadow}
        />
      </div>
    </section>
  )
}
