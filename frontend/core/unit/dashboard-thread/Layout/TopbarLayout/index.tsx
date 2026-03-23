import { TOPBAR_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import CheckLabel from '~/widgets/CheckLabel'
import ColorSelector from '~/widgets/ColorSelector'

import { FIELD } from '../../constant'
import useTopbar from '../../logic/useTopbar'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from '../../salon/layout/topbar_layout'

const TOPBAR_LAYOUT_OPTIONS = [
  {
    value: TOPBAR_LAYOUT.YES,
    titleKey: 'dsb.layout.topbar.option.with',
  },
  {
    value: TOPBAR_LAYOUT.NO,
    titleKey: 'dsb.layout.topbar.option.none',
  },
] as const

export default function TopbarLayout() {
  const s = useSalon()
  const { t } = useTrans()

  const { edit, layout, isBgTouched, isLayoutTouched, saving, bg } = useTopbar()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.topbar.title')}
        desc={t('dsb.layout.topbar.desc')}
        detailText={t('dsb.layout.view_example')}
      />
      <div className={s.select}>
        {TOPBAR_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = layout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.TOPBAR_LAYOUT)}
            >
              <div className={cn(s.block, isActive && s.blockActive)}>
                {value === TOPBAR_LAYOUT.YES && <div className={s.topBar} />}
                <div className={cn(s.bar, 'top-8 left-5 h-28 w-6/12 opacity-5')} />
                <div className={cn(s.bar, 'top-8 right-5 h-24 w-20 opacity-5')} />
              </div>
              <CheckLabel title={t(titleKey)} active={isActive} top={4} />
            </button>
          )
        })}
      </div>

      <SavingBar
        isTouched={isLayoutTouched}
        field={FIELD.TOPBAR_LAYOUT}
        loading={saving}
        top={10}
      />

      <div className='mt-8' />
      {layout === TOPBAR_LAYOUT.YES && (
        <SavingBar
          isTouched={isBgTouched}
          field={FIELD.TOPBAR_BG}
          loading={saving}
          left={-10}
          top={30}
        >
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
