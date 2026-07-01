'use client'

import {
  DSB_ALIAS_ROUTE,
  DSB_CHANGELOG_ROUTE,
  DSB_INFO_ROUTE,
  DSB_APPEARANCE_ROUTE,
  DSB_POST_ROUTE,
  DSB_ROUTE,
  DSB_SEO_ROUTE,
} from '~/const/route'
import useTrans from '~/hooks/useTrans'
import BindSVG from '~/icons/Bind'
import DomainSVG from '~/icons/Domain'
import KanbanSVG from '~/icons/Kanban'
import PostSVG from '~/icons/Post'
import ThemeSVG from '~/icons/Theme'
import DsbCovers from '~/unit/DashboardCovers'

export default function WorkplaceCoversPage() {
  const { t } = useTrans()

  return (
    <DsbCovers
      config={{
        title: t('dsb.covers.workplace.title'),
        desc: t('dsb.covers.workplace.desc'),
        items: [
          {
            groupTitle: t('dsb.covers.group.basic_info'),
            items: [
              {
                title: t('dsb.info.basic'),
                desc: t('dsb.covers.item.basic_info.desc'),
                seg: DSB_ROUTE.INFO,
                Icon: BindSVG,
              },
              {
                title: t('dsb.info.logo'),
                desc: t('dsb.covers.item.logo.desc'),
                seg: `${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.LOGOS}`,
                Icon: ThemeSVG,
              },
              {
                title: t('dsb.info.social'),
                desc: t('dsb.covers.item.social.desc'),
                seg: `${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.SOCIAL}`,
                Icon: PostSVG,
              },
              {
                title: t('common.other'),
                desc: t('dsb.covers.item.other.desc'),
                seg: `${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.OTHER}`,
                Icon: KanbanSVG,
              },
            ],
          },
          {
            groupTitle: t('dsb.menu.seo'),
            items: [
              {
                title: t('dsb.seo.search_engine'),
                desc: t('dsb.covers.item.seo_search.desc'),
                seg: DSB_ROUTE.SEO,
                Icon: BindSVG,
              },
              {
                title: t('dsb.seo.twitter'),
                desc: t('dsb.covers.item.twitter.desc'),
                seg: `${DSB_ROUTE.SEO}/${DSB_SEO_ROUTE.TWITTER}`,
                Icon: ThemeSVG,
              },
            ],
          },
          {
            groupTitle: t('dsb.menu.appearance'),
            items: [
              {
                title: t('dsb.appearance.layout'),
                desc: t('dsb.covers.item.layout.desc'),
                seg: DSB_ROUTE.APPEARANCE,
                Icon: BindSVG,
              },
              {
                title: t('dsb.appearance.post'),
                desc: t('dsb.covers.item.post.desc'),
                seg: `${DSB_ROUTE.POST}/${DSB_POST_ROUTE.LAYOUT}`,
                Icon: PostSVG,
              },
              {
                title: t('dsb.appearance.kanban'),
                desc: t('dsb.covers.item.kanban.desc'),
                seg: `${DSB_ROUTE.APPEARANCE}/${DSB_APPEARANCE_ROUTE.KANBAN}`,
                Icon: KanbanSVG,
              },
              {
                title: t('dsb.appearance.changelog'),
                desc: t('dsb.covers.item.changelog.desc'),
                seg: `${DSB_ROUTE.CHANGELOG}/${DSB_CHANGELOG_ROUTE.LAYOUT}`,
                Icon: DomainSVG,
              },
            ],
          },
          {
            groupTitle: t('dsb.covers.group.alias'),
            items: [
              {
                title: t('dsb.alias.thread'),
                desc: t('dsb.covers.item.alias_thread.desc'),
                seg: DSB_ROUTE.ALIAS,
                Icon: BindSVG,
              },
              {
                title: t('dsb.alias.kanban'),
                desc: t('dsb.covers.item.alias_kanban.desc'),
                seg: `${DSB_ROUTE.ALIAS}/${DSB_ALIAS_ROUTE.KANBAN}`,
                Icon: ThemeSVG,
              },
              {
                title: t('common.other'),
                desc: t('dsb.covers.item.alias_other.desc'),
                seg: `${DSB_ROUTE.ALIAS}/${DSB_ALIAS_ROUTE.OTHERS}`,
                Icon: PostSVG,
              },
            ],
          },
          {
            groupTitle: t('dsb.covers.group.other'),
            items: [
              {
                title: t('dsb.menu.overview'),
                desc: t('dsb.covers.item.overview.desc'),
                seg: DSB_ROUTE.INFO,
                Icon: BindSVG,
              },
              {
                title: t('dsb.info.logo'),
                desc: t('dsb.covers.item.rss.desc'),
                seg: `${DSB_ROUTE.INFO}/${DSB_INFO_ROUTE.LOGOS}`,
                Icon: ThemeSVG,
              },
              {
                title: t('dsb.menu.header'),
                desc: t('dsb.covers.item.header.desc'),
                seg: `${DSB_ROUTE.CLASSIC}`,
                Icon: PostSVG,
              },
              {
                title: t('dsb.menu.footer'),
                desc: t('dsb.covers.item.footer.desc'),
                seg: `${DSB_ROUTE.FOOTER}`,
                Icon: KanbanSVG,
              },
              {
                title: t('dsb.menu.admins'),
                desc: t('dsb.covers.item.admins.desc'),
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
