import { parsePatchFiles } from '@pierre/diffs'
import { FileDiff } from '@pierre/diffs/react'
import { useMemo } from 'react'

type TProps = {
  patch: string
  revision: number
}

export function GitPatchView({ patch, revision }: TProps) {
  const files = useMemo(() => {
    const occurrences = new Map<string, number>()
    return parsePatchFiles(patch, {
      cacheKeyPrefix: `dev-hub-${revision}`,
      throwOnError: true,
    })
      .flatMap((item) => item.files)
      .map((file) => {
        const identity = `${file.prevName || ''}-${file.name}`
        const occurrence = occurrences.get(identity) ?? 0
        occurrences.set(identity, occurrence + 1)
        return { file, key: `${identity}-${occurrence}` }
      })
  }, [patch, revision])

  return (
    <div className='git-patch-files'>
      {files.map(({ file, key }) => (
        <FileDiff
          key={key}
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
