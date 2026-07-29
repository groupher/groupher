'use client'

import { useState } from 'react'

import { ASSETS_HUB_LIST_VIEW } from './constant'
import List from './List'
import useSalon from './salon'
import type { TAssetListViewMode } from './spec'
import Toolbar from './Toolbar'
import UploadStatus from './UploadStatus'
import useAssetsHub from './useAssetsHub'

export default function AssetsHub() {
  const s = useSalon()
  const logic = useAssetsHub()
  const [viewMode, setViewMode] = useState<TAssetListViewMode>(ASSETS_HUB_LIST_VIEW.SINGLE)

  return (
    <section className={s.wrapper}>
      <Toolbar
        busy={logic.busy}
        viewMode={viewMode}
        onUpload={logic.uploadFile}
        onViewModeChange={setViewMode}
      />

      <UploadStatus
        status={logic.status}
        timings={logic.timings}
        uploadProgress={logic.uploadProgress}
      />

      <List
        assets={logic.assets}
        confirmingDeleteId={logic.confirmingDeleteId}
        deletingAssetId={logic.deletingAssetId}
        errorMessage={logic.assetsErrorMessage}
        loading={logic.loadingAssets}
        references={logic.references}
        selectedAssetId={logic.selectedAsset?.id ?? null}
        viewMode={viewMode}
        onCopy={logic.copyPublicReadUrl}
        onDelete={logic.deleteAsset}
        onOpen={logic.openPublicReadPreview}
        onSelect={logic.selectAsset}
      />
    </section>
  )
}
