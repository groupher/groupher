'use client'

import { useState } from 'react'

import { ASSETS_HUB_LIST_VIEW } from './constant'
import List from './List'
import useSalon from './salon'
import type { TPagedAssets } from './spec'
import type { TAssetListViewMode } from './spec'
import Toolbar from './Toolbar'
import UploadButton from './Toolbar/UploadButton'
import UploadStatus from './UploadStatus'
import useAssetsHub from './useAssetsHub'

export default function AssetsHub({ initialData }: { initialData?: TPagedAssets | null }) {
  const s = useSalon()
  const logic = useAssetsHub(initialData)
  const [viewMode, setViewMode] = useState<TAssetListViewMode>(ASSETS_HUB_LIST_VIEW.SINGLE)

  return (
    <section className={s.wrapper}>
      <Toolbar
        activeThread={logic.activeThread}
        searchQuery={logic.searchQuery}
        viewMode={viewMode}
        onSearchQueryChange={logic.changeSearchQuery}
        onThreadChange={logic.changeThread}
        onViewModeChange={setViewMode}
      />

      <div className={s.utilityRow}>
        <UploadButton busy={logic.busy} onUpload={logic.uploadFile} />
      </div>

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
