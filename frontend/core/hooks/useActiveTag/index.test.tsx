import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { THREAD } from '~/const/thread'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useActiveTag from '~/hooks/useActiveTag'
import { articleKeys } from '~/query'

describe('useActiveTag', () => {
  it('returns activeTag from url slug', () => {
    window.history.replaceState(null, '', '/acme/post?tag=tag-1')

    const StoreWrapper = makeStoreWrapper({
      community: { slug: 'acme' },
    })
    const queryClient = new QueryClient()
    queryClient.setQueryData(articleKeys.tagGroups('acme', THREAD.POST), [
      {
        id: 'g1',
        title: 'General',
        index: 0,
        tags: [
          { id: 't1', title: 'Tag', slug: 'tag-1' },
          { id: 't2', title: 'Other', slug: 'other' },
        ],
      },
    ])
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <StoreWrapper>{children}</StoreWrapper>
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useActiveTag(), { wrapper })
    expect(result.current?.id).toBe('t1')
  })
})
