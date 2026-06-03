import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect width='18' height='18' x='3' y='3' rx='2' />
    <path d='M9 3v18' />
  </IconBase>
)

export default SVG
