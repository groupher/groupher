import SIZE from '~/const/size'
import useTrans from '~/hooks/useTrans'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import useSalon from '../../../salon/tuning_panel/detail_panel/content'
import GroupItem from '../GroupItem'
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
        <GroupItem label={t('dsb.appearance.wallpaper.editor.shadow')}>
          <ToggleSwitch size={SIZE.TINY} checked={hasShadow} onChange={onToggleShadow} />
        </GroupItem>
      </div>
    </section>
  )
}
