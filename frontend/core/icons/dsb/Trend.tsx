import type { SVGProps } from 'react'

import { getDsbIconClassName } from '../helper'

const SVG = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width={24}
    height={24}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={getDsbIconClassName(className)}
    {...props}
  >
    <path d='M3 3v16a2 2 0 0 0 2 2h16' />
    <path d='m19 9-5 5-4-4-3 3' />
  </svg>
)

export default SVG
