import type { FC } from 'react'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'
import useSalon from '../../salon/domain/custom/domain_adder'

type TProps = {
  onNext: () => void
}

const DomainAdder: FC<TProps> = ({ onNext }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>自定义域名</div>
      <div className={s.desc}>添加你想绑定的域名，支持绑定子域名, 如 community.your-domain.com</div>

      <div className={s.inputWrapper}>
        <Input value='' placeholder='your domain' disableEnter autoFocus width='w-full' />
      </div>

      <div className={s.desc}>TODO: 裸域提示</div>
      <div className={s.br} />

      <Button disabled={false} onClick={onNext}>
        添加
      </Button>
    </div>
  )
}

export default DomainAdder
