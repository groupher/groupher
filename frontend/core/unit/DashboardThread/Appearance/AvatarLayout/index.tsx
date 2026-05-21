import { AVATAR_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useAvatar from '../../logic/useAvatar'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from './salon'

const AVATAR_LAYOUT_OPTIONS = [
  {
    value: AVATAR_LAYOUT.SQUARE,
    titleKey: 'dsb.appearance.avatar.option.square',
  },
  {
    value: AVATAR_LAYOUT.CIRCLE,
    titleKey: 'dsb.appearance.avatar.option.circle',
  },
] as const

export default function AvatarLayout() {
  const s = useSalon()

  const { edit, layout, isTouched } = useAvatar()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.appearance.avatar.title')}
        desc={t('dsb.appearance.avatar.desc')}
      />
      <div className={s.select}>
        {AVATAR_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = layout === value
          const shapeClass = value === AVATAR_LAYOUT.CIRCLE ? 'circle' : 'rounded'

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.AVATAR_LAYOUT)}
            >
              <div className={cn(s.block, isActive && s.blockActive)}>
                <div className={cn(s.avatar, s.blue, shapeClass)}>YM</div>
                <div className={s.divider} />
                <div className={s.list}>
                  <div className={cn(s.avatar, s.green, shapeClass)}>ST</div>
                  <div className={cn(s.avatar, s.red, shapeClass)}>LH</div>
                  <div className={cn(s.avatar, s.orange, shapeClass)}>UV</div>
                  <div className={cn(s.avatar, s.purple, shapeClass)}>WN</div>
                </div>
              </div>

              <CheckLabel title={t(titleKey)} active={isActive} top={3} />
            </button>
          )
        })}
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.AVATAR_LAYOUT} top={8} />
    </div>
  )
}
