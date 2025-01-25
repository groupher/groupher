import useTwBelt from '~/hooks/useTwBelt'

import LightSVG from '~/icons/ColorLight'
import QuestionSVG from '~/icons/Question'
import BugSVG from '~/icons/ColorBug'
import RejectSVG from '~/icons/Reject'
import OtherSVG from '~/icons/menu/Feedback'

type TProps = {
  smaller: boolean
}

export default ({ smaller }: TProps) => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn(
      'row-center px-1.5 py-0.5 bold',
      smaller ? 'text-xs' : 'text-sm',
      fg('text.digest'),
    ),
    text: 'mt-px',
    iconBox: 'align-both size-4 mr-0.5',
    icon: cn('size-3.5', fill('text.digest')),
    iconReject: cn('size-3', fill('rainbow.red')),
  }
}

export const Icon = {
  REJECT: RejectSVG,
  FEATURE: LightSVG,
  BUG: BugSVG,
  QUESTION: QuestionSVG,
  OTHER: OtherSVG,
}
