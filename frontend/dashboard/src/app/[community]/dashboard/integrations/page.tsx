'use client'

import { DSB_DOMAIN_ROUTE, DSB_ROUTE, DSB_THIRD_PART_ROUTE } from '~/const/route'
import useTrans from '~/hooks/useTrans'
import BindSVG from '~/icons/Bind'
import BotSVG from '~/icons/Bot'
import DomainSVG from '~/icons/Domain'
import AnalysisSVG from '~/icons/Pulse'
import EmailSVG from '~/icons/social/Email'
import WebhookSVG from '~/icons/Webhook'
import DsbCovers from '~/unit/DashboardCovers'

export default function IntegrationsPage() {
  const { t } = useTrans()

  return (
    <DsbCovers
      config={{
        title: t('dsb.covers.integrations.title'),
        desc: t('dsb.covers.integrations.desc'),
        items: [
          {
            groupTitle: t('dsb.covers.group.domain'),
            items: [
              {
                title: t('dsb.domain.platform'),
                desc: t('dsb.covers.item.platform_domain.desc'),
                seg: DSB_ROUTE.DOMAIN,
                Icon: BindSVG,
              },
              {
                title: t('dsb.domain.custom'),
                desc: t('dsb.covers.item.custom_domain.desc'),
                seg: `${DSB_ROUTE.DOMAIN}/${DSB_DOMAIN_ROUTE.CUSTOM}`,
                Icon: DomainSVG,
              },
            ],
          },
          {
            groupTitle: t('dsb.covers.group.third_part'),
            items: [
              {
                title: t('dsb.third_part.analytics'),
                desc: t('dsb.covers.item.analytics.desc'),
                seg: DSB_ROUTE['THIRD-PART'],
                Icon: AnalysisSVG,
              },
              {
                title: t('dsb.third_part.webhooks'),
                desc: t('dsb.covers.item.webhooks.desc'),
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.WEBHOOKS}`,
                Icon: WebhookSVG,
              },
              {
                title: t('dsb.third_part.bots'),
                desc: t('dsb.covers.item.bots.desc'),
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.BOTS}`,
                Icon: BotSVG,
              },
              {
                title: t('dsb.third_part.email'),
                desc: t('dsb.covers.item.email.desc'),
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.EMAIL}`,
                Icon: EmailSVG,
              },
              {
                title: t('dsb.third_part.content_sync'),
                desc: t('dsb.covers.item.content_sync.desc'),
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.CONTENT_SYNC}`,
                Icon: BindSVG,
              },
            ],
          },
        ],
      }}
    />
  )
}
