import useTwBelt from '~/hooks/useTwBelt'

type TProps = { align: 'center' | 'right' }

export default ({ align }: TProps) => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center w-auto', align ? 'justify-center' : 'justify-end'),
    cancelBtn: cn('text-xs mt-px break-keep pointer', `hover:${fg('title')}`, fg('digest')),
  }
}
