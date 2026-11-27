import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TOauthProvider } from '~/spec'
import HomeLogo from '~/ui/HomeLogo'
import LavaLampLoading from '~/ui/Loading/LavaLampLoading'

import { OAUTH_DISPLAY } from './providers'
import useSalon from './salon/loading'

type TProps = {
  provider: TOauthProvider
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
  const { Icon, name: displayProviderName } = OAUTH_DISPLAY[provider]

  return (
    <div className={s.wrapper}>
      <div className={s.iconWrapper}>
        <div className={s.providerLogo}>{Icon && <Icon className={s.icon} />}</div>
        <div className={s.sideLogo}>
          <HomeLogo size={4} />
        </div>
      </div>
      <div className={s.title}>
        {t('login.oauth.loading.title')}
        <div className={s.providerName}>[{displayProviderName}]</div>
      </div>
      <div className={s.desc}>{t('login.oauth.loading.desc')}</div>
      <div className={s.footer}>
        <LavaLampLoading />
      </div>
    </div>
  )
}

export default Loading
