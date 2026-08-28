import { type FC, useEffect, useState } from 'react'

import { SOCIAL } from '~/const/oauth'
import { lockPage, unlockPage } from '~/dom'
import { titleCase } from '~/fmt'
import useTrans from '~/hooks/useTrans'
import CloseCrossSVG from '~/icons/CloseLight'
import { signIn } from '~/oauth'
import { Link } from '~/platform'

import { OAUTH_PROVIDERS } from './constant'
import Loading, { LoadingMask } from './Loading'
import useSalon, { SocialIcon } from './salon/panel'

type TProps = {
  returnTo?: string
  show: boolean
  onClose: () => void
}

const Panel: FC<TProps> = ({ show, returnTo, onClose }) => {
  const s = useSalon()

  const [loadingProvider, setLoadingProvider] = useState(null)
  const { t } = useTrans()

  useEffect(() => {
    if (!show) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    lockPage()
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      unlockPage()
    }
  }, [onClose, show])

  if (!show) return null

  return (
    <div className='bg-modal-mask fixed inset-0 z-50 overflow-auto px-4 pt-24'>
      <button
        type='button'
        aria-label='Close sign in'
        className='absolute inset-0 size-full cursor-default'
        onClick={onClose}
      />
      <section
        aria-label='Sign in'
        aria-modal='true'
        className='border-divider bg-modal-bg shadow-modal relative z-1 mx-auto w-full max-w-md rounded-md border'
        role='dialog'
      >
        <button
          type='button'
          aria-label='Close sign in'
          className='align-both hover:bg-hoverBg absolute top-3.5 right-4 z-10 size-7 rounded-md'
          onClick={onClose}
        >
          <CloseCrossSVG className='size-5' />
        </button>
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
                <button
                  type='button'
                  className={s.socialItem}
                  key={provider}
                  onClick={() => {
                    setLoadingProvider(providerKey)
                    void signIn(SOCIAL.GITHUB, { callbackUrl: returnTo }).catch(() =>
                      setLoadingProvider(null),
                    )
                  }}
                >
                  <div className={s.iconBox}>
                    <Icon className={s.icon} />
                  </div>
                  {providerKey}
                </button>
              )
            })}
          </div>
          <div className={s.footer}>
            <Link href='/' navigation='document' className={s.link}>
              {t('login.bind.hint')}
            </Link>
            <Link href='/' navigation='document' className={s.link}>
              {t('need.help')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Panel
