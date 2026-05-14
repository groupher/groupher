import { cva } from 'class-variance-authority'

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
      width: {
        fit: 'w-max',
        full: 'w-full',
      },
      mode: {
        solid: '',
        ghost: 'bg-transparent',
      },
      interactive: {
        true: 'pointer hover:brightness-110 active:brightness-95 trans-all-200',
        false: 'cursor-not-allowed dark:brightness-90',
      },
      soft: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [{ mode: 'ghost', interactive: true, class: 'hover:brightness-125' }],
    defaultVariants: {
      width: 'fit',
      mode: 'solid',
      interactive: true,
    },
  },
)
