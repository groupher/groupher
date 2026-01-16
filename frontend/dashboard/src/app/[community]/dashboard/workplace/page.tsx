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
                desc: '品牌展示，整体布局，头像，标签等全局样式。',
                seg: DSB_ROUTE.LAYOUT,
                Icon: BindSVG,
              },
              {
                title: '主题/背景',
                desc: '社区主题色，壁纸及各种背景效果。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.THEME}`,
                Icon: ThemeSVG,
              },
              {
                title: '讨论区',
                desc: '讨论区个性化设置。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.POST}`,
                Icon: PostSVG,
              },
              {
                title: '看板',
                desc: '看板展示个性化设置。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.KANBAN}`,
                Icon: KanbanSVG,
              },
              {
                title: '更新日志',
                desc: '更新日志展示个性化设置。',
                seg: `${DSB_ROUTE.LAYOUT}/${DSB_LAYOUT_ROUTE.CHANGELOG}`,
                Icon: DomainSVG,
              },
              {
                title: '帮助台',
                desc: '文档展示个性化设置。',
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
