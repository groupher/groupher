import { AVATAR_LAYOUT } from '~/const/layout'

import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../constant'
import useAvatar from '../logic/useAvatar'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cn } from '../salon/layout/avatar_layout'

export default () => {
  const s = useSalon()

  const { edit, layout, isTouched, saving } = useAvatar()

  return (
    <div className={s.wrapper}>
      <SectionLabel title='头像样式' desc='用户/用户列表头像展示样式，作用于投票列表，评论区等。' />
      <div className={s.select}>
        <button className={s.layout} onClick={() => edit(AVATAR_LAYOUT.SQUARE, 'avatarLayout')}>
          <div className={cn(s.block, layout === AVATAR_LAYOUT.SQUARE && s.blockActive)}>
            <div className={cn(s.avatar, s.blue)}>YM</div>
            <div className={s.divider} />
            <div className={s.list}>
              <div className={cn(s.avatar, s.green)}>ST</div>
              <div className={cn(s.avatar, s.red)}>LH</div>
              <div className={cn(s.avatar, s.orange)}>UV</div>
              <div className={cn(s.avatar, s.purple)}>WN</div>
            </div>
          </div>

          <CheckLabel title='圆角方形' active={layout === AVATAR_LAYOUT.SQUARE} top={3} />
        </button>
        <button className={s.layout} onClick={() => edit(AVATAR_LAYOUT.CIRCLE, 'avatarLayout')}>
          <div className={cn(s.block, layout === AVATAR_LAYOUT.CIRCLE && s.blockActive)}>
            <div className={cn(s.avatar, s.blue, 'circle')}>YM</div>
            <div className={s.divider} />
            <div className={s.list}>
              <div className={cn(s.avatar, s.green, 'circle')}>ST</div>
              <div className={cn(s.avatar, s.red, 'circle')}>LH</div>
              <div className={cn(s.avatar, s.orange, 'circle')}>UV</div>
              <div className={cn(s.avatar, s.purple, 'circle')}>WN</div>
            </div>
          </div>

          <CheckLabel title='圆形' active={layout === AVATAR_LAYOUT.CIRCLE} top={3} />
        </button>
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.AVATAR_LAYOUT} loading={saving} top={8} />
    </div>
  )
}
