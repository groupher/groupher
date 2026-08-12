import { equals } from 'ramda'
import { type FC, useEffect, useMemo, useState } from 'react'

import { DOC_COVER_LAYOUT } from '~/const/layout'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTrans from '~/hooks/useTrans'
import useTwBelt from '~/hooks/useTwBelt'
import type { TDocCoverLayout, TMarkerValue } from '~/spec'
import MarkerPicker from '~/ui/MarkerPicker'
import { toast } from '~/ui/Toaster'
import SavingBar from '~/unit/DashboardThread/SavingBar'
import S from '~/unit/DashboardThread/schema/docs'
import { DEFAULT_GROUP_MARKER } from '~/unit/DocCovers/constant'
import type { TDocCoverCardAppearance, TDocCoverCard } from '~/unit/DocCovers/spec'

type TProps = {
  section: TDocCoverCard
  layout: TDocCoverLayout
  community: string
  onDone: (section: TDocCoverCard) => void
}

const getCapabilities = (layout: TDocCoverLayout) => ({
  marker: layout === DOC_COVER_LAYOUT.BRIEF_CARDS || layout === DOC_COVER_LAYOUT.TILE_CARDS,
})

const normalizeAppearance = (
  value: TDocCoverCard['appearance'] | string | null | undefined,
): TDocCoverCardAppearance => {
  if (!value) return {}
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value) as TDocCoverCardAppearance
  } catch {
    return {}
  }
}

const comparableAppearance = (value: TDocCoverCardAppearance): TDocCoverCardAppearance => value

const GroupSettingPanel: FC<TProps> = ({ section, layout, community, onDone }) => {
  const { cn, bg, br, fg } = useTwBelt()
  const { mutate } = useGraphQLClient()
  const { t } = useTrans()
  const capabilities = useMemo(() => getCapabilities(layout), [layout])
  const initialAppearance = useMemo(
    () => normalizeAppearance(section.appearance),
    [section.id, section.appearance],
  )
  const [appearance, setAppearance] = useState<TDocCoverCardAppearance>(() =>
    normalizeAppearance(section.appearance),
  )
  const [baselineAppearance, setBaselineAppearance] =
    useState<TDocCoverCardAppearance>(initialAppearance)
  const [saving, setSaving] = useState(false)
  const isTouched = !equals(
    comparableAppearance(appearance),
    comparableAppearance(baselineAppearance),
  )

  useEffect(() => {
    setAppearance(initialAppearance)
    setBaselineAppearance(initialAppearance)
  }, [initialAppearance])

  const updateAppearance = <K extends keyof TDocCoverCardAppearance>(
    key: K,
    value: TDocCoverCardAppearance[K],
  ): void => {
    setAppearance((current) => ({ ...current, [key]: value }))
  }

  const rollback = (): void => {
    setAppearance(baselineAppearance)
  }

  const save = async (): Promise<void> => {
    setSaving(true)

    try {
      await mutate(S.updateDocCoverCardAppearance, {
        community,
        id: section.id,
        appearance,
      })
      toast(t('dsb.cms.docs.cover.group.saved'))
      setBaselineAppearance(appearance)
      onDone({ ...section, appearance })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='column gap-6 p-8'>
      <div className='column gap-2'>
        <div className={cn('text-xl bold-sm', fg('title'))}>{section.title}</div>
        <div className={cn('text-sm', fg('digest'))}>{t('dsb.cms.docs.cover.group.settings')}</div>
      </div>

      {capabilities.marker && (
        <div className='column gap-3'>
          <div className={cn('text-sm bold-sm', fg('title'))}>
            {t('dsb.cms.docs.cover.group.icon')}
          </div>
          <div className='row-center gap-3'>
            <div className={cn('align-both size-10 rounded border', bg('card'), br('divider'))}>
              <MarkerPicker
                compact
                value={appearance.marker ?? DEFAULT_GROUP_MARKER}
                iconSize={5}
                triggerClassName='size-full'
                onChange={(marker: TMarkerValue) => updateAppearance('marker', marker)}
              />
            </div>
            <div className={cn('text-sm', fg('digest'))}>
              {t('dsb.cms.docs.cover.group.icon_desc')}
            </div>
          </div>
        </div>
      )}

      {!capabilities.marker && (
        <div className={cn('rounded border p-4 text-sm', bg('card'), br('divider'), fg('digest'))}>
          {t('dsb.cms.docs.cover.group.empty')}
        </div>
      )}

      <SavingBar
        isTouched={isTouched}
        loading={saving}
        disabled={saving}
        top={2}
        onCancel={rollback}
        onConfirm={save}
      />
    </div>
  )
}

export default GroupSettingPanel
