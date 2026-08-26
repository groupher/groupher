import type { FeedbackPost } from '../../lib/feedback'
import PostItem from './PostItem'

type Props = { posts: FeedbackPost[]; rankOffset: number }

export default function PostList({ posts, rankOffset }: Props) {
  return (
    <div className='border-divider border-t'>
      {posts.map((post, index) => (
        <PostItem key={post.id} post={post} rank={rankOffset + index + 1} />
      ))}
    </div>
  )
}
