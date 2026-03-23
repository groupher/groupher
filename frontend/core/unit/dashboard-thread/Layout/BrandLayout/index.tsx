import { BRAND_LAYOUT } from '~/const/layout'
import useTrans from '~/hooks/useTrans'
import BrandSVG from '~/icons/Brand'
import useCommunity from '~/stores/community/hooks'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../../constant'
import useBrand from '../../logic/useBrand'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from '../../salon/layout/brand_layout'

const BRAND_LAYOUT_OPTIONS = [
  {
    value: BRAND_LAYOUT.BOTH,
    titleKey: 'dsb.layout.brand.option.both',
  },
  {
    value: BRAND_LAYOUT.LOGO,
    titleKey: 'dsb.layout.brand.option.logo',
  },
  {
    value: BRAND_LAYOUT.TEXT,
    titleKey: 'dsb.layout.brand.option.text',
  },
] as const

export default function BrandLayout() {
  const s = useSalon()

  const { title } = useCommunity()
  const { edit, layout, isTouched, saving } = useBrand()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel title={t('dsb.layout.brand.title')} desc={t('dsb.layout.brand.desc')} />
      <div className={s.select}>
        {BRAND_LAYOUT_OPTIONS.map(({ value, titleKey }) => {
          const isActive = layout === value

          return (
            <button
              key={value}
              type='button'
              className={s.layout}
              aria-pressed={isActive}
              onClick={() => edit(value, FIELD.BRAND_LAYOUT)}
            >
              <div className={cn(s.block, isActive && s.blockActive)}>
                <div className={s.brand}>
                  {value !== BRAND_LAYOUT.TEXT && <BrandSVG className={s.brandIcon} />}
                  {value === BRAND_LAYOUT.BOTH && <div className='mr-2.5' />}
                  {value !== BRAND_LAYOUT.LOGO && <h3 className={s.brandTitle}>{title}</h3>}
                </div>
                <div className={s.divider} />
              </div>
              <CheckLabel title={t(titleKey)} active={isActive} top={4} />
            </button>
          )
        })}
      </div>
      <SavingBar
        isTouched={isTouched}
        field={FIELD.BRAND_LAYOUT}
        loading={saving}
        top={10}
        left={1}
      />
    </div>
  )
}
