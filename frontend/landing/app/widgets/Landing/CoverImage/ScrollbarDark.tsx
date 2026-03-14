import { range } from 'ramda'

import type { IRenderDotsProps } from 'react-scroll-snap-anime-slider'

import { cn } from '../salon/cover_image/scroll_bar'

type TProps = IRenderDotsProps

export default function ScrollbarDark({ totalSlides, currentSlide, slideTo }: TProps) {
  const wrapperClass = cn(
    'absolute bottom-6 left-1/2 align-both w-52 h-12 -ml-32 rounded-3xl z-50',
    'animate-fade-up animate-duration-500',
    'gap-x-4 backdrop-blur-sm',
    'bg-alphaBg-dark',
  )

  const dotClass = cn(
    'relative size-2 circle opacity-65 trans-all-200 pointer',
    'bg-text-digest-dark',
  )
  const dotBoxClass = 'align-both absolute w-5 h-5 -top-1.5 -left-1.5 circle pointer'

  const dotActive = 'w-12 rounded-md opacity-100'

  return (
    <div className={wrapperClass}>
      {range(0, totalSlides).map((i) => {
        const active = i === currentSlide

        return (
          <div key={i} className={cn(dotClass, active && dotActive)}>
            {!active && <div className={dotBoxClass} onClick={() => slideTo(i)} />}
          </div>
        )
      })}
    </div>
  )
}
