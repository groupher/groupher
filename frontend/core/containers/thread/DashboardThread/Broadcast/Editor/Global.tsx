import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import ColorSelector from '~/widgets/ColorSelector'
import Input from '~/widgets/Input'
import useBroadcast from '../../logic/useBroadcast'
import SavingBar from '../../SavingBar'
import SectionLabel from '../../SectionLabel'
import useSalon from '../../salon/broadcast/editor/global'
import GlobalTemplate from '../Templates/Global'

export default () => {
  const {
    saving,
    broadcastBg,
    broadcastEnable,
    broadcastOnSave,
    broadcastOnCancel,
    isTouched,
    edit,
    changeEnable,
  } = useBroadcast()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title='开启横幅广播'
        desc={<div className={s.enableDesc}>开启后，本社区内的所有页面顶部将展示广播信息</div>}
        addon={<ToggleSwitch checked={broadcastEnable} onChange={(v) => changeEnable(v)} />}
        bottom={5}
      />

      <GlobalTemplate />
      <br />

      <div className={s.item}>
        <div className={s.label}>背景色</div>
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
        <div className={s.label}>广播内容</div>
        <Input />
      </div>

      <div className={s.item}>
        <div className={s.label}>链接地址</div>
        <Input />
      </div>

      <SavingBar
        isTouched={isTouched}
        onCancel={broadcastOnCancel}
        onConfirm={broadcastOnSave}
        loading={saving}
        top={10}
      />
    </div>
  )
}
