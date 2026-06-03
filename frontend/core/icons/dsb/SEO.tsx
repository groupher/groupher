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
    <path d='m21 21-4.34-4.34' />
    <circle cx='11' cy='11' r='8' />
  </svg>
)

export default SVG
