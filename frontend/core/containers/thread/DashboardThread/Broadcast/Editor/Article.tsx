import ColorSelector from '~/widgets/ColorSelector'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import Input from '~/widgets/Input'
import useTrans from '~/hooks/useTrans'

import SectionLabel from '../../SectionLabel'
import ArticleTemplate from '../Templates/Article'
import SavingBar from '../../SavingBar'

import useBroadcast from '../../logic/useBroadcast'
import useSalon from '../../salon/broadcast/editor/article'

export default function Article() {
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
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title={t('dsb.broadcast.article.title')}
        desc={t('dsb.broadcast.article.desc')}
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
        <div className={s.label}>{t('dsb.broadcast.article.background')}</div>
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
        <div className={s.label}>{t('dsb.broadcast.article.content')}</div>
        <Input />
      </div>

      <div className={s.item}>
        <div className={s.label}>{t('dsb.broadcast.article.link')}</div>
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
