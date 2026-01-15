'use client'

import BindSVG from '~/icons/Bind'
import DsbCovers from '~/widgets/DsbCovers'

export default function IntegrationsPage() {
  return (
    <DsbCovers
      config={{
        title: '绑定与集成',
        desc: '社区内容的个性化设置',
        items: [
          {
            title: '平台域名',
            desc: 'Groupher 社区子域名设置',
            seg: 'domain',
            Icon: BindSVG,
          },
          {
            title: '自定义域名',
            desc: '绑定社区到外部域名',
            seg: 'domain/custom',
            Icon: BindSVG,
          },
        ],
      }}
    />
  )
}
