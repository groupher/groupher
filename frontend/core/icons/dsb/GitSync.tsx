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
    <path d='M15 6a9 9 0 0 0-9 9V3' />
    <circle cx='18' cy='6' r='3' />
    <circle cx='6' cy='18' r='3' />
  </svg>
)

export default SVG
