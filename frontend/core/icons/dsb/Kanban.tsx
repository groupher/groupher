import type { SVGProps } from 'react'

import IconBase from './IconBase'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d='M5 3v14' />
    <path d='M12 3v8' />
    <path d='M19 3v18' />
  </IconBase>
)

export default SVG
