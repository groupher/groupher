import { equals } from 'ramda'
import { type FC, useEffect, useMemo, useState } from 'react'

import { DOC_COVER_LAYOUT } from '~/const/layout'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import useTwBelt from '~/hooks/useTwBelt'
import type { TDocCoverLayout, TMarkerValue } from '~/spec'
import SavingBar from '~/unit/DashboardThread/SavingBar'
import S from '~/unit/DashboardThread/schema'
import { DEFAULT_GROUP_MARKER } from '~/unit/DocCovers/constant'
import type { TDocCoverGroup, TDocCoverGroupUiConfig } from '~/unit/DocCovers/spec'
import Input from '~/widgets/Input'
import MarkerPicker from '~/widgets/MarkerPicker'
import { toast } from '~/widgets/Toaster'

type TProps = {
  group: TDocCoverGroup
  layout: TDocCoverLayout
  community: string
  onDone: (group: TDocCoverGroup) => void
}

const getCapabilities = (layout: TDocCoverLayout) => ({
  marker: layout === DOC_COVER_LAYOUT.BRIEF_CARDS || layout === DOC_COVER_LAYOUT.TILE_CARDS,
  desc: layout === DOC_COVER_LAYOUT.STACK_CARDS,
})

const normalizeUiConfig = (
  value: TDocCoverGroup['uiConfig'] | string | null | undefined,
): TDocCoverGroupUiConfig => {
  if (!value) return {}
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value) as TDocCoverGroupUiConfig
  } catch {
    return {}
  }
}

const comparableUiConfig = (value: TDocCoverGroupUiConfig): TDocCoverGroupUiConfig => ({
  ...value,
  desc: value.desc || undefined,
})

const GroupSettingPanel: FC<TProps> = ({ group, layout, community, onDone }) => {
  const { cn, bg, br, fg } = useTwBelt()
  const { mutate } = useGraphQLClient()
  const capabilities = useMemo(() => getCapabilities(layout), [layout])
  const initialUiConfig = useMemo(
    () => normalizeUiConfig(group.uiConfig),
    [group.id, group.uiConfig],
  )
  const [uiConfig, setUiConfig] = useState<TDocCoverGroupUiConfig>(() =>
    normalizeUiConfig(group.uiConfig),
  )
  const [baselineUiConfig, setBaselineUiConfig] = useState<TDocCoverGroupUiConfig>(initialUiConfig)
  const [saving, setSaving] = useState(false)
  const isTouched = !equals(comparableUiConfig(uiConfig), comparableUiConfig(baselineUiConfig))

  useEffect(() => {
    setUiConfig(initialUiConfig)
    setBaselineUiConfig(initialUiConfig)
  }, [initialUiConfig])

  const updateConfig = <K extends keyof TDocCoverGroupUiConfig>(
    key: K,
    value: TDocCoverGroupUiConfig[K],
  ): void => {
    setUiConfig((current) => ({ ...current, [key]: value }))
  }

  const rollback = (): void => {
    setUiConfig(baselineUiConfig)
  }

  const save = async (): Promise<void> => {
    setSaving(true)

    try {
      await mutate(S.updateDocCoverGroupUiConfig, {
        community,
        id: group.id,
        uiConfig,
      })
      toast('Cover group settings saved.')
      setBaselineUiConfig(uiConfig)
      onDone({ ...group, uiConfig })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='column gap-6 p-8'>
      <div className='column gap-2'>
        <div className={cn('text-xl bold-sm', fg('title'))}>{group.title}</div>
        <div className={cn('text-sm', fg('digest'))}>Doc cover group settings</div>
      </div>

      {capabilities.marker && (
        <div className='column gap-3'>
          <div className={cn('text-sm bold-sm', fg('title'))}>Group icon</div>
          <div className='row-center gap-3'>
            <div className={cn('align-both size-10 rounded border', bg('card'), br('divider'))}>
              <MarkerPicker
                compact
                value={uiConfig.marker ?? DEFAULT_GROUP_MARKER}
                iconSize={5}
                triggerClassName='size-full'
                onChange={(marker: TMarkerValue) => updateConfig('marker', marker)}
              />
            </div>
            <div className={cn('text-sm', fg('digest'))}>Used by layouts with group icons.</div>
          </div>
        </div>
      )}

      {capabilities.desc && (
        <div className='column gap-3'>
          <div className={cn('text-sm bold-sm', fg('title'))}>Group description</div>
          <Input
            behavior='textarea'
            value={uiConfig.desc ?? ''}
            placeholder='Describe this group'
            className='min-h-24'
            onChange={(event) => updateConfig('desc', event.target.value)}
          />
        </div>
      )}

      {!capabilities.marker && !capabilities.desc && (
        <div className={cn('rounded border p-4 text-sm', bg('card'), br('divider'), fg('digest'))}>
          This layout has no group settings yet.
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
