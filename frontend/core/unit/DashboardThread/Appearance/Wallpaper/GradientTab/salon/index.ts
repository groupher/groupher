import type { CSSProperties } from 'react'

export { cn } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'column gap-8 mt-2.5 relative',
    gradientGrid: 'grid justify-between gap-y-5',
    gradientGridStyle: {
      gridTemplateColumns: 'repeat(11, max-content)',
    } satisfies CSSProperties,
  }
}
