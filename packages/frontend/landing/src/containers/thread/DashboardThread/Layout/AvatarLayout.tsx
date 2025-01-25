import { AVATAR_LAYOUT } from '~/const/layout'

import CheckLabel from '~/widgets/CheckLabel'

import { SETTING_FIELD } from '../constant'
import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import useAvatar from '../logic/useAvatar'
import useSalon, { cn } from '../salon/layout/avatar_layout'

export default () => {
  const s = useSalon()

  const { edit, layout, getIsTouched, saving } = useAvatar()

  const isTouched = getIsTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel title="头像样式" desc="用户/用户列表头像展示样式，作用于投票列表，评论区等。" />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(AVATAR_LAYOUT.SQUARE, 'avatarLayout')}>
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

          <CheckLabel title="圆角方形" active={layout === AVATAR_LAYOUT.SQUARE} top={3} />
        </div>
        <div className={s.layout} onClick={() => edit(AVATAR_LAYOUT.CIRCLE, 'avatarLayout')}>
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

          <CheckLabel title="圆形" active={layout === AVATAR_LAYOUT.CIRCLE} top={3} />
        </div>
      </div>
      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.AVATAR_LAYOUT}
        loading={saving}
        width="w-10/12"
        top={8}
      />
    </div>
  )
}
