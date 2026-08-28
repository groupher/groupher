import { Link } from '@tanstack/react-router'

import type { FeedbackPlatform, FeedbackPlatformSummary } from '../../lib/feedback'

type Props = { platforms: FeedbackPlatformSummary[]; selected: FeedbackPlatform }

export default function PlatformNav({ platforms, selected }: Props) {
  const totalPosts = platforms.reduce((total, platform) => total + platform.count, 0)

  return (
    <aside className='sticky top-13 flex h-[calc(100vh-104px)] flex-col text-[#a2a2a2] max-md:static max-md:h-auto'>
      <Link
        className='flex h-16 w-40 items-center justify-center rounded-2xl bg-neutral-800 p-1.5 text-white no-underline shadow-lg transition-transform active:scale-[0.96]'
        to='/'
        aria-label='Inspire Me home'
      >
        <span className='flex size-full items-center justify-center rounded-xl border-2 border-white/90 font-mono text-xs leading-none font-semibold tracking-widest'>
          INSPIRE ME
        </span>
      </Link>
      <nav
        className='mt-[46px] flex flex-col gap-2 max-md:mt-7 max-md:grid max-md:grid-cols-2'
        aria-label='Feedback platforms'
      >
        <div className='mb-2 text-[13px] font-bold text-[#bebebe] max-md:col-span-2'>Platforms</div>
        {platforms.map((platform) => (
          <Link
            key={platform.id}
            className={`grid min-h-[25px] grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-1.5 py-1 text-[15px] leading-tight no-underline ${platform.id === selected.id ? 'text-title bg-hover' : 'hover:text-title hover:bg-hover/60 text-[#9d9d9d]'}`}
            to='/$platform'
            params={{ platform: platform.id }}
          >
            <span
              className={`flex size-[18px] items-center justify-center overflow-hidden rounded-[4px] transition ${platform.id === selected.id ? 'opacity-100' : 'opacity-55 saturate-50 hover:opacity-80 hover:saturate-100'}`}
            >
              <img
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
  )
}
