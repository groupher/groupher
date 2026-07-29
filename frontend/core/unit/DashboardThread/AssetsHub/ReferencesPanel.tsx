'use client'

import IconHub from '~/widgets/IconHub'

import { ASSETS_HUB_LABEL } from './constant'
import { formatAssetRefMeta, formatAssetRefTitle } from './helper'
import useSalon from './salon/references_panel'
import type { TAsset, TReferencesState } from './spec'

type TProps = {
  asset: TAsset
  references: TReferencesState
}

export default function ReferencesPanel({ asset, references }: TProps) {
  const s = useSalon()
  const active = references.assetId === asset.id

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.title}>{ASSETS_HUB_LABEL.REFERENCES_TITLE}</div>
        {active && references.totalCount > 0 && (
          <div className={s.count}>{references.totalCount}</div>
        )}
      </div>

      {!active || references.loading ? (
        <div className={s.empty}>
          <IconHub provider='lucide' icon='loader' size={3.25} />
          {ASSETS_HUB_LABEL.REFERENCES_LOADING}
        </div>
      ) : references.error ? (
        <div className={s.empty}>
          <IconHub provider='lucide' icon='alert-triangle' size={3.25} />
          {references.error || ASSETS_HUB_LABEL.REFERENCES_ERROR}
        </div>
      ) : references.entries.length === 0 ? (
        <div className={s.empty}>
          <IconHub provider='lucide' icon='unlink' size={3.25} />
          {ASSETS_HUB_LABEL.REFERENCES_EMPTY}
        </div>
      ) : (
        <div className={s.list}>
          {references.entries.map((ref) => (
            <div className={s.item} key={ref.id}>
              <div className={s.itemTitle}>{formatAssetRefTitle(ref)}</div>
              <div className={s.itemMeta}>{formatAssetRefMeta(ref)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
