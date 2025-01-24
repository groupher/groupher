import { TAG_LAYOUT } from '~/const/layout'

import HashTagSVG from '~/icons/HashTag'
import CheckLabel from '~/widgets/CheckLabel'

import { SETTING_FIELD } from '../constant'
import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import useTags from '../logic/useTags'

import useSalon, { cn } from '../salon/layout/tag_layout'

export default () => {
  const s = useSalon()

  const { edit, tagLayout, getTagLayoutTouched, saving } = useTags()
  const isTouched = getTagLayoutTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel title="标签样式" desc="列表内容及文章详情的标签的展现形式。" />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(TAG_LAYOUT.HASH, 'tagLayout')}>
          <div className={cn(s.block, tagLayout === TAG_LAYOUT.HASH && s.blockActive)}>
            <HashTagSVG className={cn(s.hashIcon, 'left-8')} />
            <div className={cn(s.bar, 'left-16 w-10 h-1.5')} />

            <HashTagSVG className={cn(s.hashIcon, 'left-36')} />
            <div className={cn(s.bar, 'right-10 w-10 h-1.5')} />
          </div>

          <CheckLabel title="井字" active={tagLayout === TAG_LAYOUT.HASH} top={3} />
        </div>
        <div className={s.layout} onClick={() => edit(TAG_LAYOUT.DOT, 'tagLayout')}>
          <div className={cn(s.block, tagLayout === TAG_LAYOUT.DOT && s.blockActive)}>
            <div className={cn(s.circle, 'left-10')} />
            <div className={cn(s.bar, 'left-16 w-10 h-1.5')} />

            <div className={cn(s.circle, 'right-24')} />
            <div className={cn(s.bar, 'right-11 w-10 h-1.5')} />
          </div>

          <CheckLabel title="圆点" active={tagLayout === TAG_LAYOUT.DOT} top={3} />
        </div>
      </div>
      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.TAG_LAYOUT}
        loading={saving}
        width="w-10/12"
        top={10}
      />
    </div>
  )
}
