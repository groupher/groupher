import { TAG_LAYOUT } from '~/const/layout'

import HashTagSVG from '~/icons/HashTag'
import CheckLabel from '~/widgets/CheckLabel'
import useTrans from '~/hooks/useTrans'

import { FIELD } from '../constant'
import useTags from '../logic/useTags'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'

import useSalon, { cn } from '../salon/layout/tag_layout'

export default function TagLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { edit, tagLayout, tagLayoutTouched: isTouched, saving } = useTags()

  return (
    <div className={s.wrapper}>
      <SectionLabel title={t('dsb.layout.tag.title')} desc={t('dsb.layout.tag.desc')} />
      <div className={s.select}>
        <button className={s.layout} onClick={() => edit(TAG_LAYOUT.HASH, 'tagLayout')}>
          <div className={cn(s.block, tagLayout === TAG_LAYOUT.HASH && s.blockActive)}>
            <HashTagSVG className={cn(s.hashIcon, 'left-8')} />
            <div className={cn(s.bar, 'left-16 w-10 h-1.5')} />

            <HashTagSVG className={cn(s.hashIcon, 'left-36')} />
            <div className={cn(s.bar, 'right-10 w-10 h-1.5')} />
          </div>

          <CheckLabel
            title={t('dsb.layout.tag.option.hash')}
            active={tagLayout === TAG_LAYOUT.HASH}
            top={3}
          />
        </button>
        <button className={s.layout} onClick={() => edit(TAG_LAYOUT.DOT, 'tagLayout')}>
          <div className={cn(s.block, tagLayout === TAG_LAYOUT.DOT && s.blockActive)}>
            <div className={cn(s.circle, 'left-10')} />
            <div className={cn(s.bar, 'left-16 w-10 h-1.5')} />

            <div className={cn(s.circle, 'right-24')} />
            <div className={cn(s.bar, 'right-11 w-10 h-1.5')} />
          </div>

          <CheckLabel
            title={t('dsb.layout.tag.option.dot')}
            active={tagLayout === TAG_LAYOUT.DOT}
            top={3}
          />
        </button>
      </div>
      <SavingBar isTouched={isTouched} field={FIELD.TAG_LAYOUT} loading={saving} top={10} />
    </div>
  )
}
