import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FIELDS } from '~/constant/dsb-fields'
import type { TDsb } from '~/spec'

import DsbProjectionProvider from './DsbProjectionProvider'

const mocks = vi.hoisted(() => ({ projected: [] as TDsb[] }))

vi.mock('~/stores/dsbShell/hooks', () => ({
  default: () => ({ title: 'unsaved title', original: { title: 'saved title' } }),
  useDsbShellSession: () => ({ demoMode: true }),
}))
vi.mock('~/stores/dsb/provider', () => ({
  default: ({ initData, children }: { initData: TDsb; children: ReactNode }) => {
    mocks.projected.push(initData)
    return children
  },
}))
vi.mock('~/stores/ThemePreset/provider', () => ({
  default: ({ initData, children }: { initData: TDsb; children: ReactNode }) => {
    mocks.projected.push(initData)
    return children
  },
}))

describe('DsbProjectionProvider', () => {
  beforeEach(() => {
    mocks.projected.length = 0
  })

  it('projects only the saved Demo baseline to public readers', () => {
    render(
      <DsbProjectionProvider initialData={{ ...FIELDS, title: 'server title' } as TDsb}>
        <div>editor</div>
      </DsbProjectionProvider>,
    )

    expect(mocks.projected).toHaveLength(2)
    expect(mocks.projected.map(({ title }) => title)).toEqual(['saved title', 'saved title'])
  })
})
