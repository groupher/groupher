import type { FeedbackPost } from '../../lib/feedback'

type Props = { post: FeedbackPost; rank: number }

export default function PostItem({ post, rank }: Props) {
  return (
    <article className='border-divider grid grid-cols-[minmax(0,1fr)_54px] gap-6 border-b bg-white py-[22px] max-md:grid-cols-[minmax(0,1fr)_46px] max-md:gap-4'>
      <div className='min-w-0'>
        <h2 className='text-title m-0 flex items-center gap-1.5 text-lg leading-[1.35] font-semibold max-md:text-base'>
          <span className='text-digest shrink-0 text-[13px] leading-[1.35] font-semibold tabular-nums max-md:text-[12px]'>
            No.{rank}
          </span>
          <span className='group relative min-w-0 cursor-default outline-none' tabIndex={0}>
            {post.titleZh}
            <span className='text-title pointer-events-none absolute bottom-[calc(100%+8px)] left-0 z-10 w-max max-w-[min(520px,70vw)] translate-y-1 rounded-md border border-[#e5e5e5] bg-white px-2.5 py-1.5 text-[13px] leading-[1.45] font-medium opacity-0 shadow-[0_10px_30px_rgb(0_0_0/10%)] transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100'>
              {post.titleEn}
            </span>
          </span>
          <a
            className='text-link inline-flex size-4 shrink-0 items-center justify-center'
            href={post.sourceUrl}
            target='_blank'
            rel='noreferrer'
            aria-label='Open source post'
          >
            <svg
              className='size-full fill-none stroke-current stroke-2'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path d='M15 3h6v6' />
              <path d='M10 14 21 3' />
              <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
            </svg>
          </a>
        </h2>
        <p className='text-digest mt-1.5 line-clamp-3 overflow-hidden text-base leading-[1.65] max-md:text-sm'>
          {post.digestZh}
        </p>
        <div className='mt-2 flex min-h-5 gap-3'>
          {post.comments !== null ? (
            <span className='text-digest inline-flex items-center gap-1.5 text-[13px]'>
              <svg
                className='size-3.5 fill-none stroke-current stroke-2'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path d='M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' />
              </svg>
              {post.comments}
            </span>
          ) : null}
        </div>
      </div>
      <div
        className='border-outline text-title mt-0.5 flex h-14 w-12 flex-col items-center justify-center rounded-lg border text-[17px] leading-tight font-semibold max-md:h-[50px] max-md:w-[42px] max-md:text-[15px]'
        aria-label={`${post.upvotes} upvotes`}
      >
        <svg
          className='size-[17px] fill-none stroke-current stroke-2'
          viewBox='0 0 24 24'
          aria-hidden='true'
        >
          <path d='m18 15-6-6-6 6' />
        </svg>
        <span>{post.upvotes.toLocaleString()}</span>
      </div>
    </article>
  )
}
