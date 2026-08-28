import { cn } from '~/css'

export const assetLinearHover = (active: boolean): string =>
  cn(
    'group relative pointer',
    'before:z-[-1] before:absolute before:top-0 before:left-[-15px] before:w-full before:h-full before:rounded-xl before:transition-all before:duration-200 before:opacity-0',
    'hover:before:opacity-100',
    active && 'before:opacity-100',
    'article-hover-linear',
  )
