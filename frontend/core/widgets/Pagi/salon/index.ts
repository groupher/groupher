import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export { cn } from '~/css'

export default ({ ...spacing }: TProps) => {
  const { cn, fg, margin, br, bg, hover } = useTwBelt()

  return {
    wrapper: cn('row justify-center w-full', margin(spacing)),
    inner: 'row-center-between w-56',
    empty: 'align-both',
    //
    main: 'row-center ml-10 mr-8',
    slash: cn('text-xs mt-px mx-2', fg('text.digest')),
    total: cn('text-sm', fg('text.digest')),
    //
    bottomMsg: cn(
      'text-base',
      fg('text.digest'),
      'opacity-80',
      'before:content-["/\\\\*"] before:mr-2.5 before:font-mono',
      'after:content-["*/"] after:ml-2.5 after:font-mono',
    ),

    //
    arrowBlock: cn('align-both w-14 h-7', hover('bg')),
    arrowIcon: cn('size-5', hover('icon')),
    arrowDisabled: 'cursor-not-allowed',
    // ref: https://www.w3schools.com/howto/howto_css_hide_arrow_number.asp
    numInputer: cn(
      'h-7 px-0.5 py-0 outline-none border rounded-lg text-center',
      'trans-all-200',
      br('text.digest'),
      fg('text.title'),
      bg('form.inputBg'),
      `hover:${br('text.title')}`,
      `focus:${br('text.title')}`,
      '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
    ),
  }
}
