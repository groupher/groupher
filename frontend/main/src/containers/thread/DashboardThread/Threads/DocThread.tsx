import { type FC, memo } from 'react'

import type { TEnableConfig } from '~/spec'

import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import useEnable from '../logic/useEnable'
import useSalon from '../salon/threads/doc_thread'

type TProps = {
  settings: TEnableConfig
}

const DocThread: FC<TProps> = ({ settings }) => {
  const s = useSalon()
  const { enableThread } = useEnable()

  return (
    <div className={s.wrapper}>
      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>最后更新时间</h4>
          <div className="grow" />
          <ToggleSwitch
            checked={settings.docLastUpdate}
            onChange={(c) => enableThread('helpLastUpdate', c)}
          />
        </div>
        <p className={s.desc}>是否在文档底部显示当前文档的最后更新时间</p>
      </section>

      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>反馈调查</h4>
          <div className="grow" />
          <ToggleSwitch
            checked={settings.docReaction}
            onChange={(c) => enableThread('docReaction', c)}
          />
        </div>
        <p className={s.desc}>是否在文档底部显示 “本文是否有帮助?” 的反馈组件（含 Emoji）</p>
      </section>
    </div>
  )
}

export default memo(DocThread)
