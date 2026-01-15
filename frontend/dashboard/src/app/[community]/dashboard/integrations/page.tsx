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
        desc: '社区与第三方服务的配置、绑定及交互策略设置。',
        items: [
          {
            groupTitle: '域名绑定',
            items: [
              {
                title: '平台域名',
                desc: '使用 Groupher 提供的官方子域名访问社区。',
                seg: DSB_ROUTE.DOMAIN,
                Icon: BindSVG,
              },
              {
                title: '自定义域名',
                desc: '将社区绑定到你自己的域名。',
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
                desc: '接入第三方分析工具，追踪访问量、用户行为与内容表现。',
                seg: DSB_ROUTE['THIRD-PART'],
                Icon: AnalysisSVG,
              },
              {
                title: 'Webhooks',
                desc: '在社区事件发生时向外部系统推送实时通知',
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.WEBHOOKS}`,
                Icon: WebhookSVG,
              },
              {
                title: '消息机器人',
                desc: '将社区动态同步到聊天工具，用于团队通知与协作。',
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.BOTS}`,
                Icon: BotSVG,
              },
              {
                title: '电子邮件',
                desc: '配置社区邮件发送策略，包括通知、订阅与系统邮件。',
                seg: `${DSB_ROUTE['THIRD-PART']}/${DSB_THIRD_PART_ROUTE.EMAIL}`,
                Icon: EmailSVG,
              },
              {
                title: '内容同步',
                desc: '将社区内容同步到外部平台或从其他系统导入内容。',
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
