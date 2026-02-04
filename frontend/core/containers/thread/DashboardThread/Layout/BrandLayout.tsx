import { BRAND_LAYOUT } from '~/const/layout'
import useCommunity from '~/hooks/useCommunity'
import useTrans from '~/hooks/useTrans'

import BrandSVG from '~/icons/Brand'
import CheckLabel from '~/widgets/CheckLabel'

import { FIELD } from '../constant'
import useBrand from '../logic/useBrand'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cn } from '../salon/layout/brand_layout'

export default () => {
  const s = useSalon()

  const { title } = useCommunity()
  const { edit, layout, isTouched, saving } = useBrand()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel title={t('dsb.layout.brand.title')} desc={t('dsb.layout.brand.desc')} />
      <div className={s.select}>
        <button className={s.layout} onClick={() => edit(BRAND_LAYOUT.BOTH, 'brandLayout')}>
          <div className={cn(s.block, layout === BRAND_LAYOUT.BOTH && s.blockActive)}>
            <div className={s.brand}>
              <BrandSVG className={s.brandIcon} />
              <div className='mr-2.5' />
              <h3 className={s.brandTitle}>{title}</h3>
            </div>
            <div className={s.divider} />
          </div>
          <CheckLabel
            title={t('dsb.layout.brand.option.both')}
            active={layout === BRAND_LAYOUT.BOTH}
            top={4}
          />
        </button>
        <button className={s.layout} onClick={() => edit(BRAND_LAYOUT.LOGO, 'brandLayout')}>
          <div className={cn(s.block, layout === BRAND_LAYOUT.LOGO && s.blockActive)}>
            <div className={s.brand}>
              <BrandSVG className={s.brandIcon} />
            </div>
            <div className={s.divider} />
          </div>
          <CheckLabel
            title={t('dsb.layout.brand.option.logo')}
            active={layout === BRAND_LAYOUT.LOGO}
            top={4}
          />
        </button>
        <button className={s.layout} onClick={() => edit(BRAND_LAYOUT.TEXT, 'brandLayout')}>
          <div className={cn(s.block, layout === BRAND_LAYOUT.TEXT && s.blockActive)}>
            <div className={s.brand}>
              <h3 className={s.brandTitle}>{title}</h3>
            </div>
            <div className={s.divider} />
          </div>
          <CheckLabel
            title={t('dsb.layout.brand.option.text')}
            active={layout === BRAND_LAYOUT.TEXT}
            top={4}
          />
        </button>
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
