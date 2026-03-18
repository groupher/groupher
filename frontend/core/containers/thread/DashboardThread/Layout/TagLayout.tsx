import { TAG_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import HashTagSVG from '~/icons/HashTag'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../constant'
import useTags from '../logic/useTags'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'

import useSalon, { cnMerge } from '../salon/layout/tag_layout'

export default function TagLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { edit, tagLayout, tagLayoutTouched: isTouched, saving } = useTags()

  return (
    <div className={s.wrapper}>
      <SectionLabel title={t('dsb.layout.tag.title')} desc={t('dsb.layout.tag.desc')} />
      <div className={s.select}>
        <button className={s.layout} onClick={() => edit(TAG_LAYOUT.HASH, 'tagLayout')}>
          <div className={cnMerge(s.block, tagLayout === TAG_LAYOUT.HASH && s.blockActive)}>
            <HashTagSVG className={cnMerge(s.hashIcon, 'left-8')} />
            <div className={cnMerge(s.bar, 'left-16 w-10 h-1.5')} />

            <HashTagSVG className={cnMerge(s.hashIcon, 'left-36')} />
            <div className={cnMerge(s.bar, 'right-10 w-10 h-1.5')} />
          </div>

          <CheckLabel
            title={t('dsb.layout.tag.option.hash')}
            active={tagLayout === TAG_LAYOUT.HASH}
            top={3}
          />
        </button>
        <button className={s.layout} onClick={() => edit(TAG_LAYOUT.DOT, 'tagLayout')}>
          <div className={cnMerge(s.block, tagLayout === TAG_LAYOUT.DOT && s.blockActive)}>
            <div className={cnMerge(s.circle, 'left-10')} />
            <div className={cnMerge(s.bar, 'left-16 w-10 h-1.5')} />

            <div className={cnMerge(s.circle, 'right-24')} />
            <div className={cnMerge(s.bar, 'right-11 w-10 h-1.5')} />
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
