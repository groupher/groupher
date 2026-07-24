import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'relative inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap border border-transparent font-medium outline-none transition-shadow',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        outline: 'border-border bg-transparent',
        secondary: 'bg-secondary text-secondary-foreground',
        info: 'bg-info text-white',
        success: 'bg-success text-white',
        warning: 'bg-warning text-white',
        destructive: 'bg-destructive text-white',
        'info-light': 'border-info/15 bg-info/10 text-info-foreground',
        'success-light': 'border-success/15 bg-success/10 text-success-foreground',
        'warning-light': 'border-warning/15 bg-warning/10 text-warning-foreground',
        'destructive-light': 'border-destructive/15 bg-destructive/10 text-destructive-foreground',
      },
      size: {
        sm: 'h-4.5 min-w-4.5 gap-1 px-1 py-0.25 text-[0.625rem] leading-none',
        default: 'h-5 min-w-5 gap-1 px-1.25 py-0.5 text-xs',
        lg: 'h-5.5 min-w-5.5 gap-1 px-1.5 py-0.5 text-xs',
      },
      radius: {
        default: 'rounded-sm',
        full: 'rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      radius: 'default',
    },
  },
)

interface BadgeProps extends useRender.ComponentProps<'span'> {
  variant?: VariantProps<typeof badgeVariants>['variant']
  size?: VariantProps<typeof badgeVariants>['size']
  radius?: VariantProps<typeof badgeVariants>['radius']
}

function Badge({ className, variant, size, radius, render, ...props }: BadgeProps) {
  const defaultProps = {
    'data-slot': 'badge',
    className: cn(badgeVariants({ variant, size, radius, className })),
  }

  return useRender({
    defaultTagName: 'span',
    render,
    props: mergeProps<'span'>(defaultProps, props),
  })
}

export { Badge, badgeVariants, type BadgeProps }
