import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TTransKey } from '~/spec'
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
  const { t } = useTrans()
  const Icon = SocialIcon[provider || 'Github']
  const providerName = provider || 'Github'
  const providerTransKey = providerName.toUpperCase() as TTransKey

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
        {t('login.oauth.loading.title')}
        <div className={s.providerName}>[{t(providerTransKey)}]</div>
      </div>
      <div className={s.desc}>{t('login.oauth.loading.desc')}</div>
      <div className={s.footer}>
        <LavaLampLoading />
      </div>
    </div>
  )
}

export default Loading
