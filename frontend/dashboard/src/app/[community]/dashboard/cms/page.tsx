'use client'

import { DSB_ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import BindSVG from '~/icons/Bind'
import KanbanSVG from '~/icons/Kanban'
import PostSVG from '~/icons/Post'
import ThemeSVG from '~/icons/Theme'
import DsbCovers from '~/unit/DashboardCovers'

export default function CMSCoversPage() {
  const { t } = useTrans()

  return (
    <DsbCovers
      config={{
        title: t('dsb.covers.cms.title'),
        desc: t('dsb.covers.cms.desc'),
        items: [
          {
            groupTitle: t('dsb.covers.group.content'),
            items: [
              {
                title: t('dsb.menu.post'),
                desc: t('dsb.covers.item.posts.desc'),
                seg: DSB_ROUTE.POST,
                Icon: BindSVG,
              },
              {
                title: t('dsb.menu.changelog'),
                desc: t('dsb.covers.item.changelog_manage.desc'),
                seg: DSB_ROUTE.CHANGELOG,
                Icon: ThemeSVG,
              },
              {
                title: t('dsb.menu.doc'),
                desc: t('dsb.covers.item.docs.desc'),
                seg: DSB_ROUTE.DOC,
                Icon: PostSVG,
              },
              {
                title: t('dsb.menu.tags'),
                desc: t('dsb.covers.item.tags.desc'),
                seg: DSB_ROUTE.TAGS,
                Icon: KanbanSVG,
              },
            ],
          },
          {
            groupTitle: t('dsb.covers.group.users'),
            items: [
              {
                title: t('dsb.menu.communities'),
                desc: t('dsb.covers.item.communities.desc'),
                seg: DSB_ROUTE.COMMUNITIES,
                Icon: BindSVG,
              },
              {
                title: t('dsb.menu.blackhouse'),
                desc: t('dsb.covers.item.blackhouse.desc'),
                seg: DSB_ROUTE.BLACKHOUSE,
                Icon: ThemeSVG,
              },
            ],
          },
          {
            groupTitle: t('dsb.covers.group.other'),
            items: [
              {
                title: t('dsb.menu.broadcast'),
                desc: t('dsb.covers.item.broadcast.desc'),
                seg: DSB_ROUTE.BROADCAST,
                Icon: BindSVG,
              },
              {
                title: t('dsb.menu.rss'),
                desc: t('dsb.covers.item.rss.desc'),
                seg: DSB_ROUTE.RSS,
                Icon: ThemeSVG,
              },
              {
                title: t('dsb.menu.inout'),
                desc: t('dsb.covers.item.inout.desc'),
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
