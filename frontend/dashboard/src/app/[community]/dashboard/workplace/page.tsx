'use client'

import { DSB_LAYOUT_ROUTE, DSB_ROUTE } from '~/const/route'
import BindSVG from '~/icons/Bind'
import BookSVG from '~/icons/Book'
import DomainSVG from '~/icons/Domain'
import KanbanSVG from '~/icons/Kanban'
import PostSVG from '~/icons/Post'
import ThemeSVG from '~/icons/Theme'
import DsbCovers from '~/widgets/DsbCovers'

export default function LayoutsPage() {
  return (
    <DsbCovers
      config={{
        title: '工作区',
        desc: '社区基本信息，各板块或组件的个性化，管理员等设置。',
        items: [
          {
            groupTitle: '布局与样式',
            items: [
              {
                title: '通用',
                desc: '使用 Groupher 提供的官方子域名访问社区。',
                seg: DSB_ROUTE.LAYOUT,
                Icon: BindSVG,
              },
              {
                title: '主题/背景',
                desc: '将社区绑定到你自己的域名。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.THEME}`,
                Icon: ThemeSVG,
              },
              {
                title: '讨论区',
                desc: '将社区绑定到你自己的域名。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.POST}`,
                Icon: PostSVG,
              },
              {
                title: '看板',
                desc: '将社区绑定到你自己的域名。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.KANBAN}`,
                Icon: KanbanSVG,
              },
              {
                title: '更新日志',
                desc: '将社区绑定到你自己的域名。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.CHANGELOG}`,
                Icon: DomainSVG,
              },
              {
                title: '帮助台',
                desc: '将社区绑定到你自己的域名。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.DOC}`,
                Icon: BookSVG,
              },
            ],
          },
        ],
      }}
    />
  )
}
