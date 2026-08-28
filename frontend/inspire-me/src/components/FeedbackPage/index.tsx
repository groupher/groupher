import PlatformHeader from './PlatformHeader'
import PlatformNav from './PlatformNav'
import PostList from './PostList'
import type { FeedbackPageProps } from './spec'

export default function FeedbackPage({
  platforms,
  selected,
  currentPage,
  totalPages,
  rankOffset,
  posts,
}: FeedbackPageProps) {
  return (
    <main className='mx-auto grid min-h-screen w-full max-w-[1080px] grid-cols-[210px_minmax(0,780px)] gap-[58px] bg-white px-7 py-[74px] max-md:grid-cols-1 max-md:gap-8 max-md:px-5 max-md:py-8'>
      <PlatformNav platforms={platforms} selected={selected} />
      <section className='min-w-0'>
        <PlatformHeader selected={selected} currentPage={currentPage} totalPages={totalPages} />
        <PostList posts={posts} rankOffset={rankOffset} />
      </section>
    </main>
  )
}
