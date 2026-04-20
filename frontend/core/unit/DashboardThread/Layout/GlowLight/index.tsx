import { GLOW_EFFECTS_KEYS, GLOW_OPACITY } from '~/const/glow_effect'
import useDidMount from '~/hooks/useDidMount'
import useTrans from '~/hooks/useTrans'
import ClossSVG from '~/icons/CloseLight'
import DLightSVG from '~/icons/DLight'
import Radio from '~/widgets/Switcher/Radio'
import { FIELD } from '../../constant'
import useGlowLight from '../../logic/useGlowLight'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon, { cn } from '../../salon/layout/glow_light'

export default function GlowLight() {
  const s = useSalon()
  const { t } = useTrans()

  const mounted = useDidMount()

  const {
    glowType,
    glowFixed,
    glowOpacity,
    isTouched,
    isGrowFixedTouched,
    isGrowOpacityTouched, edit,
  } = useGlowLight()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.layout.glow.title')}
        desc={t('dsb.layout.glow.desc')}
        width='96%'
      />

      <div className={s.row}>
        <button
          type='button'
          className={cn(s.block, 'align-both', glowType === '' && s.blockActive)}
          aria-pressed={glowType === ''}
          onClick={() => edit('', FIELD.GLOW_TYPE)}
        >
          <div className='column-align-both'>
            <DLightSVG className={s.icon} />
            <ClossSVG className={cn(s.icon, 'size-5 opacity-60')} />
          </div>
        </button>

        {mounted &&
          GLOW_EFFECTS_KEYS.map((effect) => (
            <button
              key={effect}
              type='button'
              className={cn(s.block, effect === glowType && s.blockActive)}
              aria-pressed={effect === glowType}
              onClick={() => edit(effect, FIELD.GLOW_TYPE)}
            >
              <div className={s.bgWrapper} style={{ background: `${s.bgStyle2(effect)}` }} />
            </button>
          ))}
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.GLOW_TYPE} top={10} />

      <div className='mb-10' />

      <SavingBar isTouched={isGrowFixedTouched} field={FIELD.GLOW_FIXED}>
        <div className={s.settings}>
          <h3 className={s.title}>{t('dsb.layout.glow.follow.title')}</h3>
          <Radio
            size='small'
            items={[
              {
                value: t('dsb.layout.glow.follow.fixed'),
                key: true,
              },
              {
                value: t('dsb.layout.glow.follow.scroll'),
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
          field={FIELD.GLOW_OPACITY}
         
          top={-8}
        >
          <div className={s.settings}>
            <h3 className={s.title}>{t('dsb.layout.glow.intensity.title')}</h3>
            <Radio
              size='small'
              items={[
                {
                  value: t('dsb.layout.glow.intensity.normal'),
                  key: GLOW_OPACITY.NORMAL,
                },
                {
                  value: t('dsb.layout.glow.intensity.weak'),
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
