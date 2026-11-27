import { type FC, useCallback, useEffect, useRef, useState } from 'react'

import { listOauthProviders } from '~/auth'
import usePageLock from '~/hooks/usePageLock'
import useTrans from '~/hooks/useTrans'
import CloseCrossSVG from '~/icons/CloseLight'
import { signIn } from '~/oauth'
import { Link } from '~/platform'
import type { TOauthProvider } from '~/spec'

import Loading, { LoadingMask } from './Loading'
import { OAUTH_DISPLAY } from './providers'
import useSalon from './salon/panel'

type TProps = {
  returnTo?: string
  show: boolean
  onClose: () => void
}

const Panel: FC<TProps> = ({ show, returnTo, onClose }) => {
  const s = useSalon()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const { lockPageOnce, unlockPageOnce } = usePageLock()

  const [loadingProvider, setLoadingProvider] = useState<TOauthProvider | null>(null)
  const [providers, setProviders] = useState<
    Array<{ provider: TOauthProvider; state: 'open' | 'existing' }>
  >([])
  const [providersError, setProvidersError] = useState(false)
  const { t } = useTrans()

  const handleClose = useCallback(() => {
    unlockPageOnce()
    onClose()
  }, [onClose, unlockPageOnce])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !show || dialog.open) return

    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    lockPageOnce()

    return () => {
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close()
        else dialog.removeAttribute('open')
      }
      unlockPageOnce()
    }
  }, [lockPageOnce, show, unlockPageOnce])

  useEffect(() => {
    if (!show) return
    let active = true
    setProvidersError(false)
    void listOauthProviders()
      .then((result) => {
        if (active) setProviders(result)
      })
      .catch(() => {
        if (active) setProvidersError(true)
      })
    return () => {
      active = false
    }
  }, [show])

  if (!show) return null

  return (
    <dialog
      ref={dialogRef}
      aria-label='Sign in'
      className='bg-modal-mask fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none overflow-auto border-0 px-4 pt-24'
      onCancel={(event) => {
        event.preventDefault()
        handleClose()
      }}
    >
      <button
        type='button'
        aria-label='Close sign in'
        className='absolute inset-0 size-full cursor-default'
        onClick={handleClose}
      />
      <section
        aria-label='Sign in'
        className='border-divider bg-modal-bg shadow-modal relative z-1 mx-auto w-full max-w-md rounded-md border'
      >
        <button
          type='button'
          aria-label='Close sign in'
          className='align-both hover:bg-hoverBg absolute top-3.5 right-4 z-10 size-7 rounded-md'
          onClick={handleClose}
        >
          <CloseCrossSVG className='text-digest size-5 fill-current' />
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
            {providersError && <p role='alert'>{t('login.providers.unavailable')}</p>}
            {providers.map(({ provider, state }) => {
              const { name, Icon } = OAUTH_DISPLAY[provider]

              return (
                <button
                  type='button'
                  className={s.socialItem}
                  key={provider}
                  onClick={() => {
                    setLoadingProvider(provider)
                    void signIn(provider, { callbackUrl: returnTo }).catch(() =>
                      setLoadingProvider(null),
                    )
                  }}
                >
                  <div className={s.iconBox}>{Icon && <Icon className={s.icon} />}</div>
                  {name}
                  {state === 'existing' && ` (${t('login.providers.existing')})`}
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
    </dialog>
  )
}

export default Panel
