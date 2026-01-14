import type { FC } from 'react'
import useCommunity from '~/hooks/useCommunity'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'
import useSalon from '../salon/domain/platform'

const Domain: FC = () => {
  const s = useSalon()
  const community = useCommunity()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>平台子域名</div>
      <div className={s.desc}>
        添加绑定后，groupher 将重定向所有 groupher/{community.slug}/* 到 {community.slug}
        .groupher.com/*, 但不会将旧有的子域名内容重定向到新的子域名。90 天周期内不可再次更改。
      </div>

      <div className={s.inputWrapper}>
        <Input value='www' disableEnter autoFocus className='w-44' />
        <div className={s.domainText}>
          .groupher.com<span className={s.domainSlug}>/{community.slug}/*</span>
        </div>
      </div>

      <Button disabled={false} onClick={console.log}>
        更新
      </Button>
    </div>
  )
}

export default Domain
