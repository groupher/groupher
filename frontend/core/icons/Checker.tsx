import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg viewBox='0 0 20 20' fill='none' aria-hidden='true' {...props}>
      <path
        fill='currentColor'
        d='M16.67 5.24a1.05 1.05 0 0 1 0 1.48l-7.82 7.82a1.05 1.05 0 0 1-1.48 0L3.33 10.5a1.05 1.05 0 1 1 1.48-1.48l3.3 3.3 7.08-7.08a1.05 1.05 0 0 1 1.48 0Z'
      />
    </svg>
  )
}

export default SVG
