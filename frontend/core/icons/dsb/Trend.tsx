import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d='M3 3v16a2 2 0 0 0 2 2h16' />
    <path d='m19 9-5 5-4-4-3 3' />
  </IconBase>
)

export default SVG
