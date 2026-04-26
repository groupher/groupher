import type { FC } from 'react'

import HomeLogo from '~/widgets/HomeLogo'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useSalon, { SocialIcon } from './salon/loading'

type TProps = {
  provider: string | null
}

export const LoadingMask = () => {
  const s = useSalon()

  return (
    <>
      <div className={s.maskTop} />
      <div className={s.maskCenter} />
      <div className={s.maskBottom} />
    </>
  )
}

const Loading: FC<TProps> = ({ provider }) => {
  const s = useSalon()
  const Icon = SocialIcon[provider || 'Github']

  return (
    <div className={s.wrapper}>
      <div className={s.iconWrapper}>
        <div className={s.providerLogo}>
          <Icon className={s.icon} />
        </div>
        <div className={s.sideLogo}>
          <HomeLogo size={4} />
        </div>
      </div>
      <div className={s.title}>
        Login with <div className={s.providerName}>[{provider}]</div>
      </div>
      <div className={s.desc}>完成后会自动跳转，请不要刷新页面</div>
      <div className={s.footer}>
        <LavaLampLoading />
      </div>
    </div>
  )
}

export default Loading
