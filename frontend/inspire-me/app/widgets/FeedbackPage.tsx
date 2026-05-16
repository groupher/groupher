import Image from 'next/image'
import Link from 'next/link'

import type { FeedbackPlatform, FeedbackPost } from '../lib/feedback'

type TProps = {
  platforms: FeedbackPlatform[]
  selected: FeedbackPlatform
}

export function FeedbackPage({ platforms, selected }: TProps) {
  const totalPosts = platforms.reduce((total, platform) => total + platform.count, 0)

  return (
    <main className='mx-auto grid min-h-screen w-full max-w-[1080px] grid-cols-[210px_minmax(0,780px)] gap-[58px] bg-white px-7 py-[74px] max-md:grid-cols-1 max-md:gap-8 max-md:px-5 max-md:py-8'>
      <aside className='sticky top-13 flex h-[calc(100vh-104px)] flex-col text-[#a2a2a2] max-md:static max-md:h-auto'>
        <Link
          className="w-max -rotate-[5deg] font-['Comic_Sans_MS','Marker_Felt',cursive] text-[25px] leading-none font-bold text-[#ef4247] italic no-underline"
          href='/'
        >
          Inspiration
        </Link>

        <nav
          className='mt-[46px] flex flex-col gap-2 max-md:mt-7 max-md:grid max-md:grid-cols-2'
          aria-label='Feedback platforms'
        >
          <div className='mb-2 text-[13px] font-bold text-[#bebebe] max-md:col-span-2'>
            Platforms
          </div>
          {platforms.map((platform) => (
            <Link
              key={platform.id}
              className={`grid min-h-[25px] grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-1.5 py-1 text-[15px] leading-tight no-underline ${
                platform.id === selected.id ? 'text-title' : 'hover:text-title text-[#9d9d9d]'
              } ${platform.id === selected.id ? 'bg-hover' : 'hover:bg-hover/60'}`}
              href={`/${platform.id}`}
            >
              <span
                className={`flex size-[18px] items-center justify-center overflow-hidden rounded-[4px] transition ${
                  platform.id === selected.id
                    ? 'opacity-100'
                    : 'opacity-55 saturate-50 hover:opacity-80 hover:saturate-100'
                }`}
              >
                <Image
                  src={platform.logoPath}
                  alt=''
                  width={18}
                  height={18}
                  className='size-[18px] object-contain'
                />
              </span>
              <span className='min-w-0 truncate'>{platform.name}</span>
              <span
                className={`text-[11px] font-semibold ${platform.id === selected.id ? 'text-[#737373]' : 'text-[#9f9f9f]'}`}
              >
                {platform.count}
              </span>
            </Link>
          ))}
        </nav>

        <div className='mt-auto flex flex-col gap-1.5 text-[13px] text-[#b3b3b3] max-md:mt-5 max-md:flex-row max-md:justify-between'>
          <span>{totalPosts.toLocaleString()} posts</span>
          <span>upvotes desc</span>
        </div>
      </aside>

      <section className='min-w-0'>
        <header className='flex items-end justify-between gap-6 pb-[30px] max-md:items-start'>
          <div className='flex min-w-0 items-center gap-3.5'>
            <Image
              src={selected.logoPath}
              alt=''
              width={44}
              height={44}
              priority
              className='size-11 shrink-0 rounded-[10px] object-contain'
            />
            <div className='min-w-0'>
              <h1 className='text-title m-0 truncate text-[30px] leading-[1.08] font-bold'>
                {selected.name}
              </h1>
            </div>
          </div>
          <div className='text-title flex flex-col items-end'>
            <span className='text-[28px] leading-none font-bold'>
              {selected.count.toLocaleString()}
            </span>
            <small className='mt-1 text-xs text-[#9d9d9d]'>posts</small>
          </div>
        </header>

        <div className='border-divider border-t'>
          {selected.posts.map((post) => (
            <PostItem key={post.id} post={post} />
          ))}
        </div>
      </section>
    </main>
  )
}

function PostItem({ post }: { post: FeedbackPost }) {
  return (
    <article className='border-divider grid grid-cols-[minmax(0,1fr)_54px] gap-6 border-b bg-white py-[22px] max-md:grid-cols-[minmax(0,1fr)_46px] max-md:gap-4'>
      <div className='min-w-0'>
        <h2 className='text-title m-0 flex items-center gap-1.5 text-lg leading-[1.35] font-bold max-md:text-base'>
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
            <ExternalLinkIcon />
          </a>
        </h2>

        <p className='text-digest mt-1.5 line-clamp-3 overflow-hidden text-base leading-[1.65] max-md:text-sm'>
          {post.digestZh}
        </p>

        <div className='mt-2 flex min-h-5 gap-3'>
          {post.comments !== null && (
            <span className='text-digest inline-flex items-center gap-1.5 text-[13px]'>
              <MessageIcon />
              {post.comments}
            </span>
          )}
        </div>
      </div>

      <div
        className='border-outline text-title mt-0.5 flex h-14 w-12 flex-col items-center justify-center rounded-lg border text-[17px] leading-tight font-semibold max-md:h-[50px] max-md:w-[42px] max-md:text-[15px]'
        aria-label={`${post.upvotes} upvotes`}
      >
        <ChevronUpIcon />
        <span>{post.upvotes.toLocaleString()}</span>
      </div>
    </article>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      className='size-full fill-none stroke-current stroke-2'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path d='M15 3h6v6' />
      <path d='M10 14 21 3' />
      <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg
      className='size-3.5 fill-none stroke-current stroke-2'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path d='M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg
      className='size-[17px] fill-none stroke-current stroke-2'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path d='m18 15-6-6-6 6' />
    </svg>
  )
}
