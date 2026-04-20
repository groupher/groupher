import useTrans from '~/hooks/useTrans'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import ColorSelector from '~/widgets/ColorSelector'
import Input from '~/widgets/Input'
import useBroadcast from '../../logic/useBroadcast'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon from '../../salon/broadcast/editor/global'
import GlobalTemplate from '../Templates/Global'

export default function Global() {
  const {
    broadcastBg,
    broadcastEnable,
    broadcastOnSave,
    broadcastOnCancel,
    isTouched,
    edit,
    changeEnable,
  } = useBroadcast()
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.broadcast.global.title')}
        desc={t('dsb.broadcast.global.desc')}
        addon={<ToggleSwitch checked={broadcastEnable} onChange={(v) => changeEnable(v)} />}
        bottom={5}
      />

      <GlobalTemplate />
      <br />

      <div className={s.item}>
        <div className={s.label}>{t('dsb.broadcast.global.background')}</div>
        <div className={s.bgLabel}>
          <ColorSelector
            activeColor={broadcastBg}
            onChange={(color) => edit(color, 'broadcastBg')}
            placement='right'
            offset={[-1, 15]}
          >
            <div className={s.colorBall} />
          </ColorSelector>
        </div>
      </div>

      <div className={s.item}>
        <div className={s.label}>{t('dsb.broadcast.global.content')}</div>
        <Input />
      </div>

      <div className={s.item}>
        <div className={s.label}>{t('dsb.broadcast.global.link')}</div>
        <Input />
      </div>

      <SavingBar
        isTouched={isTouched}
        onCancel={broadcastOnCancel}
        onConfirm={broadcastOnSave}
        top={10}
      />
    </div>
  )
}
