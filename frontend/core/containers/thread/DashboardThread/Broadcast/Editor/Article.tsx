import ColorSelector from '~/widgets/ColorSelector'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import Input from '~/widgets/Input'

import SectionLabel from '../../SectionLabel'
import ArticleTemplate from '../Templates/Article'
import SavingBar from '../../SavingBar'

import useBroadcast from '../../logic/useBroadcast'
import useSalon from '../../salon/broadcast/editor/article'

export default () => {
  const {
    saving,
    broadcastArticleBg,
    broadcastOnSave,
    broadcastOnCancel,
    broadcastArticleEnable,
    isArticleTouched,
    edit,
  } = useBroadcast()

  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="开启页脚广播"
        desc="开启后，相关帖子底部会出现广播内容"
        addon={
          <ToggleSwitch
            checked={broadcastArticleEnable}
            onChange={(v) => edit(v, 'broadcastArticleEnable')}
          />
        }
      />
      <div className="mb-2.5" />

      <ArticleTemplate />
      <div className="mb-12" />

      <div className={s.item}>
        <div className={s.label}>背景色：</div>
        <div className={s.bgLabel}>
          <ColorSelector
            activeColor={broadcastArticleBg}
            onChange={(color) => edit(color, 'broadcastArticleBg')}
            placement="right"
            offset={[-1, 15]}
          >
            <div className={s.colorBall} color={broadcastArticleBg} />
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
        isTouched={isArticleTouched}
        onCancel={() => broadcastOnCancel(true)}
        onConfirm={() => broadcastOnSave(true)}
        loading={saving}
        top={10}
      />
    </div>
  )
}
