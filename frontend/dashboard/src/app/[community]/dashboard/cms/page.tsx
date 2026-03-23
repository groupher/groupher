'use client'

import { DSB_ROUTE } from '~/const/route'
import BindSVG from '~/icons/Bind'
import KanbanSVG from '~/icons/Kanban'
import PostSVG from '~/icons/Post'
import ThemeSVG from '~/icons/Theme'
import DsbCovers from '~/unit/dashboard-covers'

export default function CMSCoversPage() {
  return (
    <DsbCovers
      config={{
        title: '内容管理',
        desc: '社区内容，用户以及导入导出管理。',
        items: [
          {
            groupTitle: '文章管理',
            items: [
              {
                title: '帖子',
                desc: '帖子内容管理，状态设置等。',
                seg: DSB_ROUTE.POST,
                Icon: BindSVG,
              },
              {
                title: '更新日志',
                desc: '更新日志内容管理，状态设置等。',
                seg: DSB_ROUTE.CHANGELOG,
                Icon: ThemeSVG,
              },
              {
                title: '文档',
                desc: '文档内容，目录管理，状态设置等。',
                seg: DSB_ROUTE.DOC,
                Icon: PostSVG,
              },
              {
                title: '标签',
                desc: '各板块标签内容，样式等。',
                seg: DSB_ROUTE.TAGS,
                Icon: KanbanSVG,
              },
            ],
          },
          {
            groupTitle: '用户管理',
            items: [
              {
                title: '社区用户',
                desc: '搜索引擎原信息，标准 OG 信息。',
                seg: DSB_ROUTE.BLACKHOUSE,
                Icon: BindSVG,
              },
              {
                title: '小黑屋',
                desc: 'X(Twitter) SEO 信息优化。',
                seg: DSB_ROUTE.BLACKHOUSE,
                Icon: ThemeSVG,
              },
            ],
          },
          {
            groupTitle: '其他',
            items: [
              {
                title: '广播/广告',
                desc: '品牌展示，整体布局，头像，标签等全局样式。',
                seg: DSB_ROUTE.LAYOUT,
                Icon: BindSVG,
              },
              {
                title: 'RSS',
                desc: '社区主题色，壁纸及各种背景效果。',
                seg: DSB_ROUTE.RSS,
                Icon: ThemeSVG,
              },
              {
                title: '三方导入/导出',
                desc: '讨论区个性化设置。',
                seg: DSB_ROUTE.INOUT,
                Icon: PostSVG,
              },
            ],
          },
        ],
      }}
    />
  )
}
