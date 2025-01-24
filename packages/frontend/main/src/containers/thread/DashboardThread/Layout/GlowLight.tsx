import { GLOW_OPACITY, GLOW_EFFECTS_KEYS } from '~/const/glow_effect'

import Radio from '~/widgets/Switcher/Radio'

import DLightSVG from '~/icons/DLight'
import ClossSVG from '~/icons/CloseLight'

import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import { SETTING_FIELD } from '../constant'

import useGlowLight from '../logic/useGlowLight'
import useSalon, { cn } from '../salon/layout/glow_light'

export default () => {
  const s = useSalon()

  const {
    glowType,
    glowFixed,
    glowOpacity,
    getIsTouched,
    getIsGrowFixedTouched,
    getIsGrowOpacityTouched,
    saving,
    edit,
  } = useGlowLight()

  const isTouched = getIsTouched()
  const isGrowFixedTouched = getIsGrowFixedTouched()
  const isGrowOpacityTouched = getIsGrowOpacityTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="页面辉光"
        desc="设置后每个页面的展示光晕（阅览页面除外），可配合壁纸风格搭配。"
        width="96%"
      />

      <div className={s.row}>
        <div
          className={cn(s.block, 'align-both', glowType === '' && s.block)}
          onClick={() => edit('', 'glowType')}
        >
          <div className="column-align-both">
            <DLightSVG className={s.icon} />
            <ClossSVG className={cn(s.icon, 'size-5 opacity-60')} />
          </div>
        </div>

        {GLOW_EFFECTS_KEYS.map((effect) => (
          <div
            key={effect}
            className={cn(s.block, effect === glowType && s.blockActive)}
            onClick={() => edit(effect, 'glowType')}
          >
            <div className={s.bgWrapper} style={{ background: `${s.bgStyle2(effect)}` }} />
          </div>
        ))}
      </div>

      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.GLOW_TYPE}
        loading={saving}
        top={10}
        width="w-11/12"
      />

      <div className="mb-10" />

      <SavingBar
        isTouched={isGrowFixedTouched}
        field={SETTING_FIELD.GLOW_FIXED}
        loading={saving}
        width="w-11/12"
      >
        <div className={s.settings}>
          <h3 className={s.title}>滑动跟随:</h3>
          <Radio
            size="small"
            items={[
              {
                value: '固定位置',
                key: true,
              },
              {
                value: '随页面滚动',
                key: false,
              },
            ]}
            activeKey={glowFixed}
            onChange={(item) => edit(item.key, 'glowFixed')}
          />
        </div>
      </SavingBar>

      <div className="mb-10" />

      {glowType !== '' && (
        <SavingBar
          isTouched={isGrowOpacityTouched}
          field={SETTING_FIELD.GLOW_OPACITY}
          loading={saving}
          width="88%"
          top={-8}
        >
          <div className={s.settings}>
            <h3 className={s.title}>辉光强度:</h3>
            <Radio
              size="small"
              items={[
                {
                  value: '正常',
                  key: GLOW_OPACITY.NORMAL,
                },
                {
                  value: '弱',
                  key: GLOW_OPACITY.WEEK,
                },
              ]}
              activeKey={glowOpacity}
              onChange={(item) => edit(item.key, 'glowOpacity')}
            />
          </div>
        </SavingBar>
      )}
    </div>
  )
}
