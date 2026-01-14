import type { FC } from 'react'
import Button from '~/widgets/Buttons/Button'
import useSalon, { cn } from '../../salon/domain/custom/dns_setup'
import { DNS_RECORDS } from './constant'
import DnsRecordsTable from './DNSTable'

const DNSSetup: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>目标 DNS 设置</div>
      <div className={cn(s.desc)}>
        请在你的域名服务商（如阿里云、腾讯云、Cloudflare、DNSPod 等）中，添加以下 DNS 记录。
      </div>

      <DnsRecordsTable records={DNS_RECORDS} />

      <div className={s.title}>DNS 生效需要多久？</div>

      <div className={cn(s.desc, 'mb-5')}>
        通常几分钟内即可生效，个别情况下可能需要最长 24 小时。DNS 生效时间取决于你的域名服务商。
      </div>

      <div className={s.title}>完成 DNS 设置后呢?</div>

      <div className={cn(s.desc, 'mb-5')}>
        当你完成 DNS 设置并确认记录已生效后： 点击下方的 「开始验证」
        系统将尝试验证你的域名配置是否正确 如果 DNS 尚未生效，验证可能会失败，请稍后再试。
      </div>

      <div className={s.title}>使用 Cloudflare 的用户请注意</div>

      <div className={cn(s.desc, 'mb-5')}>
        如果你的域名使用了 Cloudflare DNS 管理： 请将本页涉及的 DNS 记录设置为 「仅 DNS（DNS
        only）」 确保 Cloudflare 的代理已关闭（橙色云朵应为灰色） 启用 Cloudflare 代理会影响 DNS
        验证，可能导致验证失败。
      </div>

      <div className={s.br} />

      <Button disabled={false} onClick={console.log}>
        验证域名
      </Button>
    </div>
  )
}

export default DNSSetup
