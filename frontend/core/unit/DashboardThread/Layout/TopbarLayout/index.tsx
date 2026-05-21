import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import CheckLabel from '~/widgets/CheckLabel'
import ColorSelector from '~/widgets/ColorSelector'

import { FIELD } from '../../constant'
import useCommunityLayout from '../../logic/useCommunityLayout'
import useTopbar from '../../logic/useTopbar'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import CommunityLayoutPreviewContent from '../CommunityLayout/CommunityLayoutPreviewContent'
import useSalon, { cn } from './salon'

const TOPBAR_LAYOUT_OPTIONS = [
  {
    value: true,
    titleKey: 'dsb.layout.topbar.option.with',
  },
  {
    value: false,
    titleKey: 'dsb.layout.topbar.option.none',
  },
] as const

export default function TopbarLayout() {
  const s = useSalon()
  const { t } = useTrans()
  const { title } = useCommunity()

  const { edit, enabled, isBgTouched, isLayoutTouched, bg } = useTopbar()
  const { layout: communityLayout } = useCommunityLayout()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.topbar.title')}
        desc={t('dsb.layout.topbar.desc')}
        detailText={t('dsb.layout.view_example')}
      />
      <div className={s.select}>
        {TOPBAR_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = enabled === value

          return (
            <button
              key={String(value)}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.TOPBAR_ENABLED)}
            >
              {value && <div className={s.topBar} />}
              <div className={cn(s.block, isActive && s.blockActive)}>
                <div className='mb-2' />
                <CommunityLayoutPreviewContent layout={communityLayout} title={title} />
              </div>
              <CheckLabel title={t(titleKey)} active={isActive} top={4} />
            </button>
          )
        })}
      </div>

      <SavingBar isTouched={isLayoutTouched} field={FIELD.TOPBAR_ENABLED} top={10} />

      <div className='mt-8' />
      {enabled && (
        <SavingBar isTouched={isBgTouched} field={FIELD.TOPBAR_BG} left={-10} top={30}>
          <div className={s.bgWrapper}>
            <div>{t('dsb.layout.topbar.color_label')}</div>
            <div className={s.bgLabel}>
              <ColorSelector
                activeColor={bg}
                onChange={(color) => edit(color, FIELD.TOPBAR_BG)}
                placement='right'
                offset={[-1, 15]}
              >
                <div className={s.theColor} />
              </ColorSelector>
            </div>
          </div>
        </SavingBar>
      )}
    </div>
  )
}
