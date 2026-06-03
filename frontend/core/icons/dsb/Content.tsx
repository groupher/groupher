import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect width='18' height='18' x='3' y='3' rx='2' />
    <path d='M21 9H3' />
    <path d='M21 15H3' />
  </IconBase>
)

export default SVG
