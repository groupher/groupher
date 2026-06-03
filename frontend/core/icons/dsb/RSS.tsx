import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d='M4 11a9 9 0 0 1 9 9' />
    <path d='M4 4a16 16 0 0 1 16 16' />
    <circle cx='5' cy='19' r='1' />
  </IconBase>
)

export default SVG
