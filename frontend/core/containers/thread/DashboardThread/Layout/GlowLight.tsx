import { GLOW_EFFECTS_KEYS, GLOW_OPACITY } from '~/const/glow_effect'
import ClossSVG from '~/icons/CloseLight'

import DLightSVG from '~/icons/DLight'
import Radio from '~/widgets/Switcher/Radio'
import { SETTING_FIELD } from '../constant'
import useGlowLight from '../logic/useGlowLight'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cn } from '../salon/layout/glow_light'

export default () => {
  const s = useSalon()

  const {
    glowType,
    glowFixed,
    glowOpacity,
    isTouched,
    isGrowFixedTouched,
    isGrowOpacityTouched,
    saving,
    edit,
  } = useGlowLight()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title='页面辉光'
        desc='设置后每个页面的展示光晕（阅览页面除外），可配合壁纸风格搭配。'
        width='96%'
      />

      <div className={s.row}>
        <button
          className={cn(s.block, 'align-both', glowType === '' && s.block)}
          onClick={() => edit('', 'glowType')}
        >
          <div className='column-align-both'>
            <DLightSVG className={s.icon} />
            <ClossSVG className={cn(s.icon, 'size-5 opacity-60')} />
          </div>
        </button>

        {GLOW_EFFECTS_KEYS.map((effect) => (
          <button
            key={effect}
            className={cn(s.block, effect === glowType && s.blockActive)}
            onClick={() => edit(effect, 'glowType')}
          >
            <div className={s.bgWrapper} style={{ background: `${s.bgStyle2(effect)}` }} />
          </button>
        ))}
      </div>

      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.GLOW_TYPE}
        loading={saving}
        top={10}
        width='w-11/12'
      />

      <div className='mb-10' />

      <SavingBar
        isTouched={isGrowFixedTouched}
        field={SETTING_FIELD.GLOW_FIXED}
        loading={saving}
        width='w-11/12'
      >
        <div className={s.settings}>
          <h3 className={s.title}>滑动跟随:</h3>
          <Radio
            size='small'
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

      <div className='mb-10' />

      {glowType !== '' && (
        <SavingBar
          isTouched={isGrowOpacityTouched}
          field={SETTING_FIELD.GLOW_OPACITY}
          loading={saving}
          width='88%'
          top={-8}
        >
          <div className={s.settings}>
            <h3 className={s.title}>辉光强度:</h3>
            <Radio
              size='small'
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
