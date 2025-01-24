import { BRAND_LAYOUT } from '~/const/layout'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import BrandSVG from '~/icons/Brand'
import CheckLabel from '~/widgets/CheckLabel'

import { SETTING_FIELD } from '../constant'
import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import useBrand from '../logic/useBrand'
import useSalon, { cn } from '../salon/layout/brand_layout'

export default () => {
  const s = useSalon()

  const curCommunity = useViewingCommunity()
  const { edit, layout, getIsTouched, saving } = useBrand()
  const isTouched = getIsTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel title="品牌样式" desc="页首 Logo 的展示形式，注意文字字体为通用社区字体。" />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(BRAND_LAYOUT.BOTH, 'brandLayout')}>
          <div className={cn(s.block, layout === BRAND_LAYOUT.BOTH && s.blockActive)}>
            <div className={s.brand}>
              <BrandSVG className={s.brandIcon} />
              <div className="mr-2.5" />
              <h3 className={s.brandTitle}>{curCommunity.title}</h3>
            </div>
            <div className={s.divider} />
          </div>
          <CheckLabel title="Logo & 文字" active={layout === BRAND_LAYOUT.BOTH} top={4} />
        </div>
        <div className={s.layout} onClick={() => edit(BRAND_LAYOUT.LOGO, 'brandLayout')}>
          <div className={cn(s.block, layout === BRAND_LAYOUT.LOGO && s.blockActive)}>
            <div className={s.brand}>
              <BrandSVG className={s.brandIcon} />
            </div>
            <div className={s.divider} />
          </div>
          <CheckLabel title="仅 Logo" active={layout === BRAND_LAYOUT.LOGO} top={4} />
        </div>
        <div className={s.layout} onClick={() => edit(BRAND_LAYOUT.TEXT, 'brandLayout')}>
          <div className={cn(s.block, layout === BRAND_LAYOUT.TEXT && s.blockActive)}>
            <div className={s.brand}>
              <h3 className={s.brandTitle}>{curCommunity.title}</h3>
            </div>
            <div className={s.divider} />
          </div>
          <CheckLabel title="仅文字" active={layout === BRAND_LAYOUT.TEXT} top={4} />
        </div>
      </div>
      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.BRAND_LAYOUT}
        loading={saving}
        top={10}
        left={1}
        width="w-11/12"
      />
    </div>
  )
}
