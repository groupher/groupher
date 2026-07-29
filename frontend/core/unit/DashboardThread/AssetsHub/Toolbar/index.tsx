'use client'

import type { TAssetListViewMode } from '../spec'
import LayoutSwitcher from './LayoutSwitcher'
import useSalon from './salon'
import SearchBar from './SearchBar'
import UploadButton from './UploadButton'

type TProps = {
  busy: boolean
  viewMode: TAssetListViewMode
  onUpload: (file: File) => Promise<void>
  onViewModeChange: (mode: TAssetListViewMode) => void
}

export default function Toolbar({ busy, viewMode, onUpload, onViewModeChange }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.left}>
        <SearchBar />
        <UploadButton busy={busy} onUpload={onUpload} />
      </div>

      <LayoutSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
    </div>
  )
}
