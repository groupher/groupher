import type { FeedbackPlatform } from '../../lib/feedback'
import Pagination from './Pagination'

type Props = { selected: FeedbackPlatform; currentPage: number; totalPages: number }

export default function PlatformHeader({ selected, currentPage, totalPages }: Props) {
  return (
    <header className='grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-6 pb-[30px] max-md:grid-cols-1 max-md:items-start max-md:gap-4'>
      <div className='flex min-w-0 items-center gap-3.5'>
        <img
          src={selected.logoPath}
          alt=''
          width={44}
          height={44}
          className='size-11 shrink-0 rounded-[10px] object-contain'
        />
        <div className='min-w-0'>
          <h1 className='text-title m-0 truncate text-[30px] leading-[1.08] font-semibold'>
            {selected.name}
          </h1>
        </div>
      </div>
      <Pagination platformId={selected.id} currentPage={currentPage} totalPages={totalPages} />
      <div className='text-title flex flex-col items-end'>
        <span className='text-[28px] leading-none font-bold'>
          {selected.count.toLocaleString()}
        </span>
        <small className='mt-1 text-xs text-[#9d9d9d]'>posts</small>
      </div>
    </header>
  )
}
