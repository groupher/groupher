import { type FC, useState } from 'react'
import Link from 'next/link'

import { signIn } from '~/oauth'
import { titleCase } from '~/fmt'

import useTrans from '~/hooks/useTrans'
import Modal from '~/widgets/Modal'

import { OAUTH_PROVIDERS } from './constant'
import Loading, { LoadingMask } from './Loading'

import useSalon, { SocialIcon } from './salon/panel'

type TProps = {
  show: boolean
  onClose: () => void
}

const Panel: FC<TProps> = ({ show, onClose }) => {
  const s = useSalon()

  const [loadingProvider, setLoadingProvider] = useState(null)
  const { t } = useTrans()

  return (
    <Modal show={show} width="400px" onClose={() => onClose()} showCloseBtn>
      <div className={s.wrapper}>
        {loadingProvider && (
          <>
            <LoadingMask />
            <Loading provider={loadingProvider} />
          </>
        )}
        <div className={s.header}>{t('login.with.social')}</div>
        <div className={s.body}>
          {OAUTH_PROVIDERS.map((provider) => {
            const providerKey = titleCase(provider)
            const Icon = SocialIcon[providerKey] || null

            return (
              <div
                className={s.socialItem}
                key={provider}
                onClick={() => {
                  signIn('github')
                  setLoadingProvider(providerKey)
                }}
              >
                <div className={s.iconBox}>
                  <Icon className={s.icon} />
                </div>
                {providerKey}
              </div>
            )
          })}
        </div>
        <div className={s.footer}>
          <Link href="/" className={s.link}>
            {t('login.bind.hint')}
          </Link>
          <Link href="/" className={s.link}>
            {t('need.help')}
          </Link>
        </div>
      </div>
    </Modal>
  )
}

export default Panel
