import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { dsbKeys } from '~/query'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TDsb } from '~/spec'
import useDsb from '~/stores/dsb/hooks'
import { writeDemoFields } from '~/stores/dsbShell/demoFields'
import { useDsbShellSession } from '~/stores/dsbShell/hooks'
import useDsbShell, { useDsbShellStore } from '~/stores/dsbShell/hooks'

import { updateDashboardPagiMode } from '../schema/settings'
import ModeOptions from './ModeOptions'
import useSalon from './salon/settings'

/** Edits the one community preference shared by feeds and the root comment list. */
export default function PagiModeSettings() {
  const s = useSalon()
  const { t } = useTrans()
  const { community, demoMode } = useDsbShellSession()
  const dashboard = useDsb()
  const dsb$ = useDsbShell()
  const liveDsb$ = useDsbShellStore()
  const client = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = dsb$.original.pagiMode ?? dashboard.pagiMode ?? 'PAGE'
  const currentMobile =
    dsb$.original.pagiMobileMode ?? dashboard.pagiMobileMode ?? 'INFINITE_SCROLL'
  const mode = dsb$.pagiMode
  const mobileMode = dsb$.pagiMobileMode
  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const submitted = { pagiMode: mode, pagiMobileMode: mobileMode }
      if (demoMode) {
        writeDemoFields(community, submitted)
        liveDsb$.reconcile({
          fields: ['pagiMode', 'pagiMobileMode'],
          submitted,
          confirmed: submitted,
        })
        return
      }

      const result = await executeCommand({
        request: (variables) => browserGraphQLRequest(updateDashboardPagiMode, variables),
        variables: {
          community,
          mode,
          mobileMode,
          expectedRevision: dashboard.pagiRevision ?? 0,
        },
      })
      const saved = result.updateDashboardPagiMode
      if (saved) {
        const confirmed = {
          pagiMode: saved.pagiMode,
          pagiMobileMode: saved.pagiMobileMode,
        }
        liveDsb$.reconcile({
          fields: ['pagiMode', 'pagiMobileMode'],
          submitted: { pagiMode: mode, pagiMobileMode: mobileMode },
          confirmed,
        })
        client.setQueryData<TDsb>(dsbKeys.slug(community), (previous) =>
          previous ? { ...previous, ...confirmed, pagiRevision: saved.pagiRevision } : previous,
        )
      }
    } catch (failure) {
      setError(String(failure))
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className={s.wrapper}>
      <p className={s.hint}>{t('dsb.pagi.description')}</p>
      <ModeOptions
        name='pagi-mode'
        title={t('dsb.pagi.desktop')}
        mode={mode}
        disabled={saving}
        onChange={(value) => liveDsb$.edit('pagiMode', value)}
      />
      <ModeOptions
        name='pagi-mobile-mode'
        title={t('dsb.pagi.mobile')}
        mode={mobileMode}
        disabled={saving}
        onChange={(value) => liveDsb$.edit('pagiMobileMode', value)}
      />
      <p className={s.hint}>{t('dsb.pagi.replies')}</p>
      {error && <p role='alert'>{error}</p>}
      <button
        type='button'
        className={s.save}
        disabled={saving || (mode === current && mobileMode === currentMobile)}
        aria-busy={saving}
        onClick={() => void save()}
      >
        {t('dsb.pagi.save')}
      </button>
    </section>
  )
}
