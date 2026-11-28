import { useEffect, useState } from 'react'

import {
  beginLinkedOauthAccount,
  cancelOauthLink,
  confirmOauthLink,
  listLinkedOauthAccounts,
  listOauthProviders,
  readOauthLinkConfirmation,
  unlinkLinkedOauthAccount,
  type TLinkedOauthAccount,
} from '~/auth'
import useTrans from '~/hooks/useTrans'
import { oauthDisplay } from '~/ui/AccountUnit/providers'
import Modal from '~/ui/Modal'

import useSalon from './salon'

type TProps = { show: boolean; onClose: () => void }
type TConfirmation = { provider: string; providerId: string; login: string | null }

export default function AccountConnections({ show, onClose }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const [accounts, setAccounts] = useState<TLinkedOauthAccount[]>([])
  const [providers, setProviders] = useState<Array<{ provider: string; state: string }>>([])
  const [confirmation, setConfirmation] = useState<TConfirmation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    if (!show) return
    let active = true
    const load = async () => {
      try {
        const [bindings, available] = await Promise.all([
          listLinkedOauthAccounts(),
          listOauthProviders(),
        ])
        const linkResult = new URL(window.location.href).searchParams.get('oauthLink')
        const pending = linkResult === 'confirm'
        const target = pending ? await readOauthLinkConfirmation() : null
        if (active) {
          setAccounts(bindings)
          setProviders(available)
          setConfirmation(target)
          setResult(linkResult)
          setError(false)
        }
      } catch {
        if (active) setError(true)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [show])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(false)
    try {
      await action()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} width='min(28rem, calc(100vw - 2rem))' showCloseBtn>
      <div className={s.wrapper}>
        <h2 className={s.title}>{t('account.connections.title')}</h2>
        {error && (
          <p role='alert' className={s.error}>
            {t('account.connections.error')}
          </p>
        )}
        {result === 'already_linked' && <p>{t('account.connections.already_linked')}</p>}
        {result === 'cancelled' && <p>{t('account.connections.cancelled')}</p>}
        {result === 'error' && <p role='alert'>{t('account.connections.error')}</p>}
        {confirmation && (
          <section className={s.list}>
            <p>
              {t('account.connections.confirm')} {confirmation.provider} ·{' '}
              {confirmation.login || confirmation.providerId}
            </p>
            <button
              type='button'
              className={s.button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await confirmOauthLink(confirmation.provider, confirmation.providerId)
                  setConfirmation(null)
                  const url = new URL(window.location.href)
                  url.searchParams.delete('oauthLink')
                  window.history.replaceState(window.history.state, '', url)
                  setAccounts(await listLinkedOauthAccounts())
                })
              }
            >
              {t('account.connections.confirm_action')}
            </button>
            <button
              type='button'
              className={s.button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await cancelOauthLink()
                  setConfirmation(null)
                  const url = new URL(window.location.href)
                  url.searchParams.delete('oauthLink')
                  window.history.replaceState(window.history.state, '', url)
                })
              }
            >
              {t('account.connections.cancel')}
            </button>
          </section>
        )}
        <div className={s.list}>
          {accounts.map((account) => {
            const display = oauthDisplay(account.provider)
            const Icon = display?.Icon
            return (
              <div className={s.item} key={account.publicRef}>
                <span className='row items-center gap-2'>
                  {Icon && <Icon className='size-5 fill-current' aria-hidden='true' />}
                  {display?.name ?? t('account.providers.unknown')} ·{' '}
                  {account.login || account.nickname || account.publicRef}
                </span>
                <button
                  type='button'
                  className={s.button}
                  disabled={busy || !account.canUnlink}
                  onClick={() =>
                    void run(async () => {
                      setAccounts(await unlinkLinkedOauthAccount(account.publicRef))
                    })
                  }
                >
                  {t('account.connections.unlink')}
                </button>
              </div>
            )
          })}
          {providers
            .filter(
              ({ provider, state }) =>
                state === 'open' && !accounts.some((account) => account.provider === provider),
            )
            .map(({ provider }) => (
              <button
                key={provider}
                type='button'
                className={s.button}
                disabled={busy}
                onClick={() => void run(() => beginLinkedOauthAccount(provider))}
              >
                {t('account.connections.link')}{' '}
                {oauthDisplay(provider)?.name ?? t('account.providers.unknown')}
              </button>
            ))}
        </div>
      </div>
    </Modal>
  )
}
