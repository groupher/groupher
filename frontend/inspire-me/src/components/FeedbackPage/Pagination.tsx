import PageLink from './PageLink'

type VisiblePage = number | `gap-${number}-${number}`
type Props = { platformId: string; currentPage: number; totalPages: number }

export default function Pagination({ platformId, currentPage, totalPages }: Props) {
  if (totalPages <= 1) return <div />
  const pages = visiblePages(currentPage, totalPages)

  return (
    <nav className='flex items-center gap-1.5' aria-label='Posts pages'>
      <PageLink platformId={platformId} page={currentPage - 1} disabled={currentPage === 1}>
        Prev
      </PageLink>
      {pages.map((page) =>
        typeof page === 'string' ? (
          <span key={page} className='text-digest px-1 text-[13px]'>
            ...
          </span>
        ) : (
          <PageLink key={page} platformId={platformId} page={page} active={page === currentPage}>
            {page}
          </PageLink>
        ),
      )}
      <PageLink
        platformId={platformId}
        page={currentPage + 1}
        disabled={currentPage === totalPages}
      >
        Next
      </PageLink>
    </nav>
  )
}

function visiblePages(currentPage: number, totalPages: number): VisiblePage[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)
  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1]
    return previous && page - previous > 1 ? [`gap-${previous}-${page}` as const, page] : [page]
  })
}
