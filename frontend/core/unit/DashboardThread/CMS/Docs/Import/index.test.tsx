import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PHASE } from './constant'
import DocumentImport from './index'
import type { TContentImportJob } from './spec'

const mocks = vi.hoisted(() => ({
  logic: {} as Record<string, unknown>,
}))

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/stores/community/hooks', () => ({
  default: () => ({ slug: 'home' }),
}))

vi.mock('~/widgets/Buttons/Button', () => ({
  default: ({ children }: { children: ReactNode }) => <button type='button'>{children}</button>,
}))

vi.mock('./useLogic', () => ({
  default: () => mocks.logic,
}))

vi.mock('../../ContentImport/ProcessLog', () => ({
  default: ({ process }: { process: { progress?: { completed: number; total?: number } } }) => (
    <div>
      {process.progress
        ? `${process.progress.completed} / ${process.progress.total ?? '--'}`
        : 'no progress'}
    </div>
  ),
}))

vi.mock('./salon', () => ({
  default: () => ({
    description: 'description',
    error: 'error',
    failureCard: 'failure-card',
    intro: 'intro',
    title: 'title',
    wrapper: 'wrapper',
  }),
}))

vi.mock('./salon/importing_step', () => ({
  default: () => ({
    description: 'description',
    progressCount: 'progress-count',
    spinner: 'spinner',
    title: 'title',
    wrapper: 'wrapper',
  }),
}))

vi.mock('./AnalyzingStep', () => ({ default: () => null }))
vi.mock('./CompletedStep', () => ({ default: () => null }))
vi.mock('./ImportIssues', () => ({ default: () => null }))
vi.mock('./RepoStep', () => ({ default: () => null }))
vi.mock('./ReviewStep', () => ({ default: () => null }))
vi.mock('./Stepper', () => ({ default: () => null }))

const runningProcess = {
  progress: { completed: 3, total: 5, unit: 'document' as const },
  recentBatch: [],
  stage: 'preparing' as const,
  state: 'running' as const,
  updatedAt: '2026-07-22T08:00:00.000Z',
}

describe('DocumentImport importing state', () => {
  beforeEach(() => {
    mocks.logic = {
      error: '',
      job: null,
      phase: PHASE.IMPORTING,
      pollingDisconnected: false,
      process: {
        ...runningProcess,
        progress: { completed: 0, total: 3, unit: 'document' },
      },
    }
  })

  it('renders immediate feedback before the import job is available', () => {
    render(<DocumentImport />)

    expect(
      screen.getByRole('heading', {
        name: 'dsb.doc.bulk_import.importing.title',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('0 / 3')).toBeInTheDocument()
  })

  it('shows persisted job progress once polling returns the job', () => {
    mocks.logic = {
      ...mocks.logic,
      job: { failedItems: [], skipped: [] } as TContentImportJob,
      process: runningProcess,
    }

    render(<DocumentImport />)

    expect(
      screen.getByRole('heading', { name: 'dsb.doc.bulk_import.importing.title' }),
    ).toBeInTheDocument()
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
  })
})
