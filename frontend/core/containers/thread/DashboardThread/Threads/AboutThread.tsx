import { type FC, memo } from 'react'

import type { TEnableConfig } from '~/spec'

import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'

import useEnable from '../logic/useEnable'
import useSalon from '../salon/threads/doc_thread'

type TProps = {
  settings: TEnableConfig
}

const AboutThread: FC<TProps> = ({ settings }) => {
  const s = useSalon()
  const { enableThread } = useEnable()

  return (
    <div className={s.wrapper}>
      <section className={s.section}>
        <div className={s.header}>
          <h3 className={s.title}>技术栈</h3>
          <div className="grow" />
          <ToggleSwitch
            checked={settings.aboutTechstack}
            onChange={(c) => enableThread('aboutTechstack', c)}
          />
        </div>
        <p className={s.desc}>团队所使用的主要工具/服务等</p>
      </section>

      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>所在地</h4>
          <div className="grow" />
          <ToggleSwitch
            checked={settings.aboutLocation}
            onChange={(c) => enableThread('aboutLocation', c)}
          />
        </div>
        <p className={s.desc}>团队或团队成员国家/城市信息（手动填写，非 IP 探测）</p>
      </section>

      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>链接</h4>
          <div className="grow" />
          <ToggleSwitch
            checked={settings.aboutLinks}
            onChange={(c) => enableThread('aboutLinks', c)}
          />
        </div>
        <p className={s.desc}>其他模块或相关链接。</p>
      </section>

      <section className={s.section}>
        <div className={s.header}>
          <h4 className={s.title}>媒体报道</h4>
          <div className="grow" />
          <ToggleSwitch
            checked={settings.aboutMediaReport}
            onChange={(c) => enableThread('aboutMediaReport', c)}
          />
        </div>
        <p className={s.desc}>其他媒体报道的文章/播客/视频等链接。</p>
      </section>
    </div>
  )
}

export default memo(AboutThread)
