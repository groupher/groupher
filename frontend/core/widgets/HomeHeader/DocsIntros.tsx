'use client'

import type { FC } from 'react'

import useSalon from './salon/docs_intro'

const DocsIntros: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.block}>
        <div className={s.head}>
          <div className={s.title}>快速开始</div>
        </div>
        <div className={s.content}>
          <div className={s.contentBorder} />
          <div className={s.item}>创建新社区</div>
          <div className={s.item}>初始化设置</div>
          <div className={s.item}>现有内容导入</div>
          <div className={s.more}>更多..</div>
        </div>
      </div>

      <div className={s.block}>
        <div className={s.head}>
          <div className={s.title}>管理后台</div>
        </div>
        <div className={s.content}>
          <div className={s.contentBorder} />
          <div className={s.item}>社区概览，统计与分析</div>
          <div className={s.item}>社区个性化</div>
          <div className={s.item}>内容审核与状态</div>
          <div className={s.more}>更多..</div>
        </div>
      </div>

      <div className={s.block}>
        <div className={s.head}>
          <div className={s.title}>品牌个性化</div>
        </div>
        <div className={s.content}>
          <div className={s.contentBorder} />
          <div className={s.item}>创建新社区</div>
          <div className={s.item}>完整论坛功能，方便用户的功能需求，问题上报，常规讨论等</div>
          <div className={s.item}>完整论坛功能，方便用户的功能需求，问题上报，常规讨论等</div>
          <div className={s.more}>更多..</div>
        </div>
      </div>

      <div className={s.block}>
        <div className={s.head}>
          <div className={s.title}>私有部署</div>
        </div>
        <div className={s.content}>
          <div className={s.contentBorder} />
          <div className={s.item}>创建新社区</div>
          <div className={s.item}>完整论坛功能，方便用户的功能需求，问题上报，常规讨论等</div>
          <div className={s.item}>完整论坛功能，方便用户的功能需求，问题上报，常规讨论等</div>
          <div className={s.more}>更多..</div>
        </div>
      </div>

      <div className={s.block}>
        <div className={s.head}>
          <div className={s.title}>快速开始</div>
        </div>
        <div className={s.content}>
          <div className={s.contentBorder} />
          <div className={s.item}>创建新社区</div>
          <div className={s.item}>完整论坛功能，方便用户的功能需求，问题上报，常规讨论等</div>
          <div className={s.item}>完整论坛功能，方便用户的功能需求，问题上报，常规讨论等</div>
          <div className={s.more}>更多..</div>
        </div>
      </div>
    </div>
  )
}

export default DocsIntros
