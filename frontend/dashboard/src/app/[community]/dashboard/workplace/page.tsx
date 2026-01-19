'use client'

import { DSB_ALIAS_ROUTE, DSB_INFO_ROUTE, DSB_LAYOUT_ROUTE, DSB_ROUTE } from '~/const/route'
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
            groupTitle: '基本信息',
            items: [
              {
                title: '常规信息',
                desc: '品牌展示，整体布局，头像，标签等全局样式。',
                seg: DSB_ROUTE.INFO,
                Icon: BindSVG,
              },
              {
                title: 'Logo',
                desc: '社区 Logo 的上传与展示设置。',
                seg: `${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.LOGOS}`,
                Icon: ThemeSVG,
              },
              {
                title: '社交媒体',
                desc: '社区社交媒体账号与外部链接设置。',
                seg: `${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.SOCIAL}`,
                Icon: PostSVG,
              },
              {
                title: '其他',
                desc: '其他基础信息与扩展配置。',
                seg: `${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.OTHER}`,
                Icon: KanbanSVG,
              },
            ],
          },
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
          {
            groupTitle: '别名映射',
            items: [
              {
                title: '板块入口',
                desc: '板块全局命名。',
                seg: DSB_ROUTE.ALIAS,
                Icon: BindSVG,
              },
              {
                title: '看板',
                desc: '看板相关模块命名。',
                seg: `${DSB_ROUTE.ALIAS}/${DSB_ALIAS_ROUTE.KANBAN}`,
                Icon: ThemeSVG,
              },
              {
                title: '其他',
                desc: '其他组件命名。',
                seg: `${DSB_ROUTE.ALIAS}/${DSB_ALIAS_ROUTE.OTHERS}`,
                Icon: PostSVG,
              },
            ],
          },
          {
            groupTitle: '其他',
            items: [
              {
                title: '概览',
                desc: '品牌展示，整体布局，头像，标签等全局样式。',
                seg: DSB_ROUTE.INFO,
                Icon: BindSVG,
              },
              {
                title: 'Logo',
                desc: '社区主题色，壁纸及各种背景效果。',
                seg: `${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.LOGOS}`,
                Icon: ThemeSVG,
              },
              {
                title: '页头',
                desc: '页头自定义链接，编组等',
                seg: `${DSB_ROUTE.HEADER}`,
                Icon: PostSVG,
              },
              {
                title: '页脚',
                desc: '页脚自定义链接，编组等',
                seg: `${DSB_ROUTE.FOOTER}`,
                Icon: KanbanSVG,
              },
              {
                title: '管理员',
                desc: '管理员管理，权限设置。',
                seg: `${DSB_ROUTE.ADMINS}`,
                Icon: KanbanSVG,
              },
            ],
          },
        ],
      }}
    />
  )
}
