import { parsePatchFiles } from '@pierre/diffs'
import { FileDiff } from '@pierre/diffs/react'
import { useMemo } from 'react'

type TProps = {
  patch: string
  revision: number
}

export function GitPatchView({ patch, revision }: TProps) {
  const files = useMemo(
    () => parsePatchFiles(patch, `dev-hub-${revision}`, true).flatMap((item) => item.files),
    [patch, revision],
  )

  return (
    <div className='git-patch-files'>
      {files.map((file, index) => (
        <FileDiff
          key={`${file.prevName || ''}-${file.name}-${index}`}
          fileDiff={file}
          options={{
            diffStyle: 'unified',
            diffIndicators: 'bars',
            lineDiffType: 'word-alt',
            overflow: 'scroll',
            stickyHeader: true,
            theme: 'github-light',
            themeType: 'light',
          }}
        />
      ))}
    </div>
  )
}
