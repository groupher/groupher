import { renderHook } from '@testing-library/react'

import type { TNameAlias } from '~/spec'

import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useNameAlias from '~/hooks/useNameAlias'

describe('useNameAlias', () => {
  it('builds alias mapping by group', () => {
    const wrapper = makeStoreWrapper({
      dashboard: {
        nameAlias: [
          { group: 'kanban', slug: 'post', name: 'Ideas' },
          { group: 'misc', slug: 'doc', name: 'Docs' },
        ] satisfies readonly TNameAlias[],
      },
    })

    const { result } = renderHook(
      () => ({
        kanban: useNameAlias('kanban'),
        all: useNameAlias(''),
      }),
      { wrapper },
    )

    expect(result.current.kanban.post.name).toBe('Ideas')
    expect(result.current.kanban.doc).toBeUndefined()
    expect(result.current.all.doc.name).toBe('Docs')
  })
})
