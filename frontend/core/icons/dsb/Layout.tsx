import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect width='18' height='7' x='3' y='3' rx='1' />
    <rect width='9' height='7' x='3' y='14' rx='1' />
    <rect width='5' height='7' x='16' y='14' rx='1' />
  </IconBase>
)

export default SVG
