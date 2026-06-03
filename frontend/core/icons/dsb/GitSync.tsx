import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d='M15 6a9 9 0 0 0-9 9V3' />
    <circle cx='18' cy='6' r='3' />
    <circle cx='6' cy='18' r='3' />
  </IconBase>
)

export default SVG
