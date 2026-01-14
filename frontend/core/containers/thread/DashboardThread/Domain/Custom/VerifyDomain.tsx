import type { FC } from 'react'
import Button from '~/widgets/Buttons/Button'
import useSalon, { cn } from '../../salon/domain/custom/verify_domain'
import { VERIFYING_DOMAIN_ROWS } from './constant'
import VerifyingTable from './VerifyingTable'

const VerifyDomain: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>域名验证</div>

      <div className={cn(s.desc, 'mb-5')}>
        系统正在检测你的 DNS 配置是否生效。 DNS 生效后，系统会立即完成验证，你无需重复操作。
      </div>

      <div className={s.title}>当前验证的 DNS 记录</div>
      <div className={cn(s.desc, 'mb-3')}>请确认你的域名服务商中已正确添加以下记录。</div>

      <VerifyingTable rows={VERIFYING_DOMAIN_ROWS} />

      <div className={cn(s.desc, 'mb-4')}>
        DNS 修改通常在几分钟内生效，个别情况下可能需要最长 24 小时。
        如果暂未验证成功，请耐心等待，系统会持续检测。
      </div>

      <div className={s.br} />

      <div className={s.footer}>
        <Button disabled onClick={() => {}}>
          验证中…
        </Button>

        <Button type='red' onClick={() => {}}>
          删除绑定
        </Button>
      </div>
    </div>
  )
}

export default VerifyDomain
