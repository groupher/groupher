import { cva, type VariantProps } from 'class-variance-authority'

export const buttonWrapper = cva(
  'group w-max select-none touch-manipulation outline-none bg-none whitespace-nowrap rounded-xl',
  {
    variants: {
      border: {
        default: 'border-4',
        none: 'border-0',
        disabled: 'border-2',
      },
      width: {
        fit: 'w-fit',
        full: 'w-full',
      },
    },
    defaultVariants: {
      border: 'default',
      width: 'fit',
    },
  },
)

export const buttonInner = cva(
  'align-both w-max relative text-center break-keep border border-transparent',
  {
    variants: {
      mode: {
        solid: '',
        ghost: 'bg-transparent',
      },
      interactive: {
        true: 'pointer hover:brightness-110 active:brightness-95 trans-all-200',
        false: 'cursor-not-allowed dark:brightness-90',
      },
      noLeftRound: {
        true: 'rounded-tl-none rounded-bl-none',
      },
      // soft 你目前没放任何 class，可先保留（或者删掉这个 variant）
      soft: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [{ mode: 'ghost', interactive: true, class: 'hover:brightness-125' }],
    defaultVariants: {
      mode: 'solid',
      interactive: true,
    },
  },
)

export type ButtonInnerVariants = VariantProps<typeof buttonInner>
