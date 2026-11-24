import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import ReviewStep from './ReviewStep'
import type { TDocImportPreview } from './spec'

vi.mock('~/hooks/useTrans', () => ({
  default: () => ({ t: (key: string) => key }),
}))

vi.mock('~/hooks/useMetric', () => ({ default: () => 'COMMUNITY' }))
vi.mock('~/hooks/useAvatarLayout', () => ({
  default: () => ({ avatarLayout: 'CIRCLE', isSquare: false }),
}))

const preview: TDocImportPreview = {
  badSmells: [],
  conflicts: [],
  counts: { assets: 0, groups: 1, links: 0, pages: 2, tabs: 1 },
  expiresAt: '2026-11-24T08:00:00Z',
  previewRef: 'prv_123456',
  attemptRef: 'att_123456',
  sourceInfo: {
    branch: 'main',
    commit: 'a123456',
    configPaths: [],
    contentRoot: '',
    framework: 'vitepress',
    repo: 'acme/docs',
    repoUrl: 'https://github.com/acme/docs',
  },
  targetRevision: 'reviewed-revision',
  targetTree: {
    tabs: [
      {
        sourceId: 'tab',
        title: 'Docs',
        groups: [
          {
            sourceId: 'guide',
            title: 'Guide',
            type: 'group',
            pages: [
              { sourceId: 'install.md', title: 'Install', type: 'page', disposition: 'overwrite' },
              { sourceId: 'faq.md', title: 'FAQ', type: 'page', disposition: 'create' },
            ],
          },
        ],
      },
    ],
  },
  tree: { navigation: [] },
}

const confirm = () => screen.getByRole('checkbox', { name: /review\.confirm_overwrite/ })
const submit = () => screen.getByRole('button', { name: /review\.confirm / })
const faq = () => screen.getByRole('checkbox', { name: /select FAQ/ })

describe('Docs import Review', () => {
  it('binds overwrite confirmation to the reviewed selection and revision', () => {
    const apply = vi.fn()
    const reset = vi.fn()
    const { rerender } = render(<ReviewStep preview={preview} apply={apply} reset={reset} />)
    expect(submit()).toBeDisabled()

    fireEvent.click(confirm())
    expect(submit()).toBeEnabled()
    fireEvent.click(faq())
    expect(confirm()).not.toBeChecked()
    expect(submit()).toBeDisabled()

    fireEvent.click(confirm())
    rerender(
      <ReviewStep preview={{ ...preview, targetRevision: 'later' }} apply={apply} reset={reset} />,
    )
    expect(submit()).toBeDisabled()
    fireEvent.click(confirm())
    fireEvent.click(submit())
    expect(apply).toHaveBeenCalledWith(['install.md'], ['install.md'])
  })

  it('allows importing the remaining new pages after deselecting a conflict', () => {
    const apply = vi.fn()
    render(
      <ReviewStep
        preview={{
          ...preview,
          conflicts: [{ sourceId: 'install.md', code: 'target_identity_conflict' }],
        }}
        apply={apply}
        reset={vi.fn()}
      />,
    )
    expect(screen.getByText('dsb.doc.bulk_import.review.conflict')).toBeInTheDocument()
    expect(submit()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /select Install/ }))
    expect(screen.queryByRole('checkbox', { name: /confirm_overwrite/ })).toBeNull()
    fireEvent.click(submit())
    expect(apply).toHaveBeenCalledWith(['faq.md'], [])
  })
  it('requires a fresh Review for an overwrite without an attempt reference', () => {
    const apply = vi.fn()
    render(
      <ReviewStep preview={{ ...preview, attemptRef: undefined }} apply={apply} reset={vi.fn()} />,
    )
    expect(submit()).toBeDisabled()
    expect(screen.getByText('dsb.doc.bulk_import.review.preview_changed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /select Install/ }))
    fireEvent.click(submit())
    expect(apply).toHaveBeenCalledWith(['faq.md'], [])
  })
})
