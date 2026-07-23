import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ImportProcessLog from '.'

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('./salon', () => ({
  default: () => ({
    bottomDivider: 'bottom-divider',
    content: 'content',
    disconnected: 'disconnected',
    divider: 'divider',
    progress: 'progress',
    progressCount: 'progress-count',
    progressLabel: 'progress-label',
    stageLive: 'stage-live',
    steps: 'steps',
    wrapper: 'wrapper',
  }),
}))

vi.mock('./salon/process_step', () => ({
  default: () => ({
    activeDetailText: 'active-detail-text',
    activeLabel: 'active-label',
    activeIconBox: 'active-icon-box',
    checkIcon: 'check-icon',
    content: 'content',
    detail: 'detail',
    detailDot: 'detail-dot',
    details: 'details',
    failedIcon: 'failed-icon',
    failedIconBox: 'failed-icon-box',
    iconBox: 'icon-box',
    item: 'item',
    label: 'label',
    loadingIcon: 'loading-icon',
    pendingDot: 'pending-dot',
    pendingIconBox: 'pending-icon-box',
    pendingLabel: 'pending-label',
  }),
}))

vi.mock('./salon/recent_batch', () => ({
  default: () => ({
    completedMark: 'completed-mark',
    failedMark: 'failed-mark',
    item: 'item',
    label: 'label',
    list: 'list',
    skippedMark: 'skipped-mark',
    state: 'state',
    title: 'title',
    wrapper: 'wrapper',
  }),
}))

describe('ImportProcessLog', () => {
  it('renders real progress and the latest bounded batch', () => {
    render(
      <ImportProcessLog
        process={{
          progress: { completed: 6, total: 12, unit: 'document' },
          recentBatch: [
            { label: 'docs/guide/start.md', ref: 'start', state: 'completed' },
            { label: 'docs/guide/large.md', ref: 'large', state: 'skipped' },
          ],
          stage: 'preparing',
          state: 'running',
          updatedAt: '2026-07-22T08:00:00.000Z',
        }}
      />,
    )

    expect(screen.getByText('6 / 12')).toBeInTheDocument()
    expect(screen.getByText('docs/guide/start.md')).toBeInTheDocument()
    expect(screen.getByText('docs/guide/large.md')).toBeInTheDocument()
    expect(screen.getByText('dsb.content_import.process.skipped')).toBeInTheDocument()
    expect(
      screen.getByText('dsb.content_import.process.preparing', { selector: '.active-label' }),
    ).toBeInTheDocument()
    expect(screen.getByText('dsb.content_import.process.preparing_convert')).toHaveClass(
      'active-detail-text',
    )
    expect(screen.getByText('dsb.content_import.process.applying_write')).not.toHaveClass(
      'active-detail-text',
    )
  })

  it('shows reconnecting separately from the authoritative process state', () => {
    render(
      <ImportProcessLog
        disconnected
        process={{
          recentBatch: [],
          stage: 'building_preview',
          state: 'running',
          updatedAt: '2026-07-22T08:00:00.000Z',
        }}
      />,
    )

    expect(screen.getAllByText('dsb.content_import.process.building_preview')).toHaveLength(2)
    expect(screen.getByText('dsb.content_import.process.reconnecting')).toBeInTheDocument()
  })
})
