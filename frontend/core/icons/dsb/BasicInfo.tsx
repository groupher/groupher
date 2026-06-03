import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx='12' cy='12' r='10' />
    <path d='M12 16v-4' />
    <path d='M12 8h.01' />
  </IconBase>
)

export default SVG
