import { useEffect, useRef, useState } from 'react'

import { cancelOauthRegistration, completeOauthRegistration, readOauthRegistration } from '~/auth'
import usePageLock from '~/hooks/usePageLock'
import useTrans from '~/hooks/useTrans'
import CloseCrossSVG from '~/icons/CloseLight'
import { oauthDisplay } from '~/ui/AccountUnit/providers'

export default function Registration({ onClose }: { onClose: () => void }) {
  const { t } = useTrans()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const { lockPageOnce, unlockPageOnce } = usePageLock()
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    lockPageOnce()
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
      unlockPageOnce()
    }
  }, [lockPageOnce, unlockPageOnce])
  const [login, setLogin] = useState('')
  const [provider, setProvider] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void readOauthRegistration()
      .then((result) => {
        if (!active) return
        setLogin(result.suggestedLogin || '')
        setProvider(result.provider)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError(t('account.registration.expired'))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [t])

  const close = () => {
    if (busy) return
    void cancelOauthRegistration().catch(() => undefined)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={t('account.registration.title')}
      className='bg-modal-mask fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none overflow-auto border-0 px-4 pt-24'
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <button
        type='button'
        aria-label='Close modal backdrop'
        className='absolute inset-0 size-full cursor-default'
        onClick={close}
      />
      <section className='border-divider bg-modal-bg shadow-modal relative z-1 mx-auto w-full max-w-md rounded-md border'>
        <button
          type='button'
          aria-label='Close modal'
          className='align-both hover:bg-hoverBg absolute top-3.5 right-4 z-10 size-7 rounded-md'
          onClick={close}
        >
          <CloseCrossSVG className='text-digest size-5 fill-current' />
        </button>
        <form
          className='column text-title gap-4 p-6'
          onSubmit={(event) => {
            event.preventDefault()
            if (busy) return
            setBusy(true)
            setError('')
            void completeOauthRegistration(login)
              .then(() => {
                const url = new URL(window.location.href)
                url.searchParams.delete('oauthRegistration')
                window.location.replace(url.toString())
              })
              .catch(() => {
                setError(t('account.registration.failed'))
                setBusy(false)
              })
          }}
        >
          <h2 className='bold-sm text-xl'>{t('account.registration.title')}</h2>
          {provider && (
            <p className='text-digest text-sm'>
              {t('account.registration.provider')}{' '}
              {oauthDisplay(provider)?.name ?? t('account.providers.unknown')}
            </p>
          )}
          {error && (
            <p role='alert' className='text-rainbow-red text-sm'>
              {error}
            </p>
          )}
          {!loading && provider && (
            <>
              <label htmlFor='registration-login' className='text-sm'>
                {t('account.registration.username')}
              </label>
              <input
                id='registration-login'
                className='border-divider bg-card rounded-lg border px-3 py-2'
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                maxLength={30}
                autoComplete='username'
                required
              />
              <button
                type='submit'
                disabled={busy}
                className='border-divider rounded-lg border px-4 py-2 disabled:opacity-50'
              >
                {t('account.registration.submit')}
              </button>
            </>
          )}
          <button
            type='button'
            disabled={busy}
            onClick={close}
            className='border-divider rounded-lg border px-4 py-2 disabled:opacity-50'
          >
            {t('account.registration.cancel')}
          </button>
        </form>
      </section>
    </dialog>
  )
}
