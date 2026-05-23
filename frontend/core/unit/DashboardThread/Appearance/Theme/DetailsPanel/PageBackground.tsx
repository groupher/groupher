import type { TThemeDetails } from '../spec'
import CustomPageBg from './CustomPageBg'

type TProps = {
  details: TThemeDetails
}

export default function PageBackground({ details }: TProps) {
  return (
    <CustomPageBg
      key={details.pageBgResetKey}
      draft={details.selectedPageBgDraft}
      hueResetKey={details.pageBgResetKey}
      onDraftChange={details.onPageBgCommit}
      onPreviewPatch={details.onPageBgPreview}
      onScheduleCommitPatch={details.onPageBgCommit}
      onImmediateCommitPatch={details.onPageBgCommit}
      showToggle={false}
      showThemeSelector={false}
    />
  )
}
