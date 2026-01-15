'use client'

import { DSB_DOMAIN_ROUTE, DSB_ROUTE, DSB_THIRD_PART_ROUTE } from '~/const/route'
import BindSVG from '~/icons/Bind'
import BotSVG from '~/icons/Bot'
import DomainSVG from '~/icons/Domain'
import AnalysisSVG from '~/icons/Pulse'
import EmailSVG from '~/icons/social/Email'
import WebhookSVG from '~/icons/Webhook'
import DsbCovers from '~/widgets/DsbCovers'

export default function IntegrationsPage() {
  return (
    <DsbCovers
      config={{
        title: '绑定与集成',
        desc: '社区与第三方服务的配置，绑定以及交互策略设置。',
        items: [
          {
            groupTitle: '域名绑定',
            items: [
              {
                title: '平台域名',
                desc: 'Groupher 社区子域名设置',
                seg: DSB_ROUTE.DOMAIN,
                Icon: BindSVG,
              },
              {
                title: '自定义域名',
                desc: '绑定社区到外部域名',
                seg: `${DSB_ROUTE.DOMAIN}/${DSB_DOMAIN_ROUTE.CUSTOM}`,
                Icon: DomainSVG,
              },
            ],
          },
          {
            groupTitle: '三方集成',
            items: [
              {
                title: '统计分析',
                desc: 'Groupher 社区子域名设置',
                seg: DSB_ROUTE['THIRD-PART'],
                Icon: AnalysisSVG,
              },
              {
                title: 'Webhooks',
                desc: '绑定社区到外部域名',
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.WEBHOOKS}`,
                Icon: WebhookSVG,
              },
              {
                title: '消息机器人',
                desc: '绑定社区到外部域名',
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.BOTS}`,
                Icon: BotSVG,
              },
              {
                title: '电子邮件',
                desc: '绑定社区到外部域名',
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.EMAIL}`,
                Icon: EmailSVG,
              },
              {
                title: '内容同步',
                desc: '绑定社区到外部域名',
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
