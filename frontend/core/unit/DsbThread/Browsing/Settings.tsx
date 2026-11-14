import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { dsbKeys } from '~/query'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TPaginationMode, TParseDashboard } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDsbConfig from '~/stores/dsbConfig/hooks'

import { updateDashboardPagiMode } from '../schema/settings'
import ModeOptions from './ModeOptions'
import useSalon from './salon/settings'

/** Edits the one community preference shared by feeds and the root comment list. */
export default function PagiModeSettings() {
  const s = useSalon()
  const { t } = useTrans()
  const { slug } = useCommunity()
  const dashboard = useDsbConfig()
  const client = useQueryClient()
  const [draft, setDraft] = useState<{
    slug: string
    mode: TPaginationMode
    mobileMode: TPaginationMode
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = dashboard.pagiMode ?? 'page'
  const currentMobile = dashboard.pagiMobileMode ?? 'infinite_scroll'
  const mode = draft?.slug === slug ? draft.mode : current
  const mobileMode = draft?.slug === slug ? draft.mobileMode : currentMobile
  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await executeCommand({
        request: (variables) => browserGraphQLRequest(updateDashboardPagiMode, variables),
        variables: {
          community: slug,
          mode: mode.toUpperCase() as Uppercase<TPaginationMode>,
          mobileMode: mobileMode.toUpperCase() as Uppercase<TPaginationMode>,
          expectedRevision: dashboard.pagiRevision ?? 0,
        },
      })
      const saved = result.updateDashboardPagiMode
      if (saved) {
        const patch = {
          pagiMode: saved.pagiMode.toLowerCase() as TPaginationMode,
          pagiMobileMode: saved.pagiMobileMode.toLowerCase() as TPaginationMode,
          pagiRevision: saved.pagiRevision,
        }
        client.setQueryData<TParseDashboard>(dsbKeys.slug(slug), (previous) =>
          previous
            ? { ...previous, ...patch, original: { ...previous.original, ...patch } }
            : previous,
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
        onChange={(value) => setDraft({ slug, mode: value, mobileMode })}
      />
      <ModeOptions
        name='pagi-mobile-mode'
        title={t('dsb.pagi.mobile')}
        mode={mobileMode}
        disabled={saving}
        onChange={(value) => setDraft({ slug, mode, mobileMode: value })}
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
