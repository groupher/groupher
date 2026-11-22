import type { ComponentProps } from 'react'

import type { TPaginationMode } from '~/spec'

import InfiniteScroll from './InfiniteScroll'
import LoadMore from './LoadMore'

type TProps = ComponentProps<typeof LoadMore> & { mode: TPaginationMode }

/** Selects the configured cursor interaction while sharing loading and explicit retry UI. */
export default function CursorPagination({ mode, ...props }: TProps) {
  return mode === 'INFINITE_SCROLL' ? <InfiniteScroll {...props} /> : <LoadMore {...props} />
}
