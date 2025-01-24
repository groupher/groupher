import { includes } from 'ramda'

import { THREAD } from '~/const/thread'

import ColorSelector from '~/widgets/ColorSelector'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import { SETTING_FIELD } from '../constant'

import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import useWidgets from '../logic/useWidgets'
import useSalon, { cn } from '../salon/widgets/base_setting'

export default () => {
  const s = useSalon()

  const {
    widgetsPrimaryColor,
    widgetsThreads,
    saving,
    getIsThreadTouched,
    getIsPrimaryColorTouched,
    edit,
    threadOnChange,
  } = useWidgets()

  const isThreadTouched = getIsThreadTouched()
  const isPrimaryColorTouched = getIsPrimaryColorTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel title="组件主题色" desc="默认与当前社区设置的主题色相一致。" />
      <SavingBar
        isTouched={isPrimaryColorTouched}
        field={SETTING_FIELD.WIDGETS_PRIMARY_COLOR}
        loading={saving}
        bottom={2}
      >
        <label className={s.label}>
          <ColorSelector
            activeColor={widgetsPrimaryColor}
            onChange={(color) => edit(color, 'widgetsPrimaryColor')}
            placement="right"
            offset={[-1, 15]}
          >
            <div className={s.theColor} />
          </ColorSelector>
        </label>
      </SavingBar>

      <div className="mt-8" />
      <SectionLabel
        title="展示板块"
        desc="被勾选的板块会在组件中以 Tab 形式展示相关内容，展示样式与‘社区板块’中的设置保持一致"
      />

      <div className={s.threads}>
        <div className={s.section}>
          <div className={s.header}>
            <h3 className={s.threadTitle}>讨论</h3>
            <div className="grow" />
            <ToggleSwitch
              checked={includes(THREAD.POST, widgetsThreads)}
              onChange={(checked) => threadOnChange(checked, THREAD.POST)}
            />
          </div>
          <div className={s.desc}>社区内全部帖子列表</div>
        </div>
        <div className={s.section}>
          <div className={s.header}>
            <h3 className={s.threadTitle}>看板</h3>
            <div className="grow" />
            <ToggleSwitch
              checked={includes(THREAD.KANBAN, widgetsThreads)}
              onChange={(checked) => threadOnChange(checked, THREAD.KANBAN)}
            />
          </div>
          <div className={s.desc}>社区内看板内容，包含GTD标签</div>
        </div>
        <div className={s.section}>
          <div className={s.header}>
            <h3 className={s.threadTitle}>更新日志</h3>
            <div className="grow" />
            <ToggleSwitch
              checked={includes(THREAD.CHANGELOG, widgetsThreads)}
              onChange={(checked) => threadOnChange(checked, THREAD.CHANGELOG)}
            />
          </div>
          <div className={s.desc}>最新版本以及历史发布版本</div>
        </div>
        <div className={s.section}>
          <div className={s.header}>
            <h3 className={s.threadTitle}>帮助台</h3>
            <div className="grow" />
            <ToggleSwitch
              checked={includes(THREAD.DOC, widgetsThreads)}
              onChange={(checked) => threadOnChange(checked, THREAD.DOC)}
            />
          </div>
          <div className={s.desc}>常见问题与帮助中心文档</div>
        </div>
      </div>

      <div className={cn(isThreadTouched ? 'mt-5' : 'mt-14')} />

      <SavingBar
        isTouched={isThreadTouched}
        field={SETTING_FIELD.WIDGETS_THREADS}
        loading={saving}
        top={10}
        bottom={10}
      />
    </div>
  )
}
