import useTwBelt from '~/hooks/useTwBelt'
import Img from '~/Img'

export default function LandingBrand() {
  const { cn, fg } = useTwBelt()

  return (
    <div className='row-center'>
      <Img
        src='/groupher.png'
        className='mr-1 size-5 overflow-hidden rounded-md object-cover'
        noLazy
      />
      <h1 className={cn('bold-sm max-w-[80px] grow text-base', fg('digest'))}>Groupher</h1>
    </div>
  )
}
