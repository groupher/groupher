import Image from 'next/image'
import type { FC } from 'react'

import useSalon, { cn } from '../salon/third_part'

export const INTEGRATE_ANALYSIS_TOOLS = [
  {
    key: 'ga',
    title: 'Google Analytics',
    desc: '页面访问量、来源渠道、用户路径、事件与转化数据。',
    homepage: 'https://developers.google.com/analytics',
  },
  {
    key: 'gtm',
    title: 'Google Tag Manager',
    desc: '基于触发条件加载和管理第三方脚本与事件标签。',
    homepage: 'https://developers.google.com/tag-platform/tag-manager',
  },
  {
    key: 'fb_pixel',
    title: 'Facebook Pixel ID',
    desc: '广告访问、转化事件与受众数据回传。',
    homepage: 'https://developers.facebook.com/docs/meta-pixel',
  },
  {
    key: 'hotjar',
    title: 'Hotjar Site ID',
    desc: '页面点击与滚动热力图，以及用户会话回放。',
    homepage: 'https://www.hotjar.com/guides/',
  },
  {
    key: 'clarity',
    title: 'MS Clarity',
    desc: '用户会话回放、点击与滚动热力图。',
    homepage: 'https://learn.microsoft.com/zh-cn/clarity/',
  },
  {
    key: 'plausible',
    title: 'Plausible Analytics',
    desc: '页面访问量、来源渠道与基础事件统计，不使用第三方 Cookie。',
    homepage: 'https://plausible.io/docs',
  },
  {
    key: 'fathom',
    title: 'Fathom Analytics Site ID',
    desc: '页面访问量与事件统计，支持无 Cookie 追踪。',
    homepage: 'https://usefathom.com/docs',
  },
  {
    key: 'umami',
    title: 'Umami Analytics',
    desc: '页面访问量、事件与来源数据，支持自托管部署。',
    homepage: 'https://umami.is/docs',
  },
  {
    key: 'matomo',
    title: 'Matomo Analytics',
    desc: '访问量、事件、目标、用户路径与自定义报表分析。',
    homepage: 'https://developer.matomo.org/integration',
  },
]

const ThirdPart: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        {INTEGRATE_ANALYSIS_TOOLS.map((item) => (
          <div key={item.key} className={s.block}>
            <div className={s.iconBox}>
              <Image
                src={`/integrations/${item.key}.png`}
                alt={`${item.title} icon`}
                width={28}
                height={28}
                className={cn(
                  s.icon,
                  item.key === 'hotjar' && 'w-14 h-auto',
                  item.key === 'gtm' && 'w-12 h-auto',
                )}
                priority={false}
                unoptimized
              />
            </div>

            <div className={s.title}>{item.title}</div>
            <div className={s.desc}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ThirdPart
