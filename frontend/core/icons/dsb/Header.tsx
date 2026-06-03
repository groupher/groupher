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
    <rect width='18' height='18' x='3' y='3' rx='2' />
    <path d='M3 9h18' />
  </svg>
)

export default SVG
