import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d='m21 21-4.34-4.34' />
    <circle cx='11' cy='11' r='8' />
  </IconBase>
)

export default SVG
