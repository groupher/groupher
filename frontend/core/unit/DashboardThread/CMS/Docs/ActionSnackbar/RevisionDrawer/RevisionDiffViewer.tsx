import type { FC } from 'react'

import { REVISION_DRAWER } from '../constant'
import useSalon, { cn } from './salon/revision_diff'
import type { TRevisionDiffBlock, TRevisionInlineDiff } from './helper'

type TProps = {
  blocks: TRevisionDiffBlock[]
}

type TRenderRow = {
  id: string
  marker: '' | '+' | '-'
  segments: TRevisionInlineDiff[]
  type: 'context' | 'added' | 'removed'
}

const hasChangedSegment = (
  segments: TRevisionInlineDiff[] | undefined,
  type: TRevisionInlineDiff['type'],
): boolean => !!segments?.some((segment) => segment.type === type)

const makeRenderRows = (blocks: TRevisionDiffBlock[]): TRenderRow[] => {
  const rows: TRenderRow[] = []

  for (const block of blocks) {
    if (block.type === 'context') {
      rows.push({
        id: `${block.id}-context`,
        marker: '',
        segments: block.afterInline || [],
        type: 'context',
      })
      continue
    }

    if (block.type === 'added') {
      rows.push({
        id: `${block.id}-added`,
        marker: '+',
        segments: block.afterInline || [],
        type: 'added',
      })
      continue
    }

    if (block.type === 'removed') {
      rows.push({
        id: `${block.id}-removed`,
        marker: '-',
        segments: block.beforeInline || [],
        type: 'removed',
      })
      continue
    }

    if (hasChangedSegment(block.beforeInline, 'removed')) {
      rows.push({
        id: `${block.id}-modified-removed`,
        marker: '-',
        segments: block.beforeInline || [],
        type: 'removed',
      })
    }

    if (hasChangedSegment(block.afterInline, 'added')) {
      rows.push({
        id: `${block.id}-modified-added`,
        marker: '+',
        segments: block.afterInline || [],
        type: 'added',
      })
    }
  }

  return rows
}

const RevisionDiffViewer: FC<TProps> = ({ blocks }) => {
  const s = useSalon()
  const rows = makeRenderRows(blocks)
  const visibleRows = rows.filter((row) => row.type !== 'context' || row.segments.length > 0)
  const hasChanges = blocks.some((block) => block.type !== 'context')

  if (!hasChanges) {
    return <div className={s.empty}>{REVISION_DRAWER.NO_CURRENT_CHANGES}</div>
  }

  return (
    <div className={s.wrapper}>
      {visibleRows.map((row) => (
        <div
          key={row.id}
          className={cn(
            s.row,
            row.type === 'added' && s.addedRow,
            row.type === 'removed' && s.removedRow,
          )}
        >
          <span className={s.marker}>{row.marker}</span>
          <span className={s.text}>
            {row.segments.map((segment) => (
              <span
                key={`${row.id}-${segment.id}`}
                className={cn(
                  segment.type === 'added' && s.addedSegment,
                  segment.type === 'removed' && s.removedSegment,
                )}
              >
                {segment.text}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

export default RevisionDiffViewer
