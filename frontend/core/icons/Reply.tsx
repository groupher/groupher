import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width={200}
    height={200}
    className='icon'
    viewBox='0 0 1024 1024'
    {...props}
  >
    <path d='M609.835 140.501a42.667 42.667 0 0 0 0 60.331L793.003 384h-323.67a384 384 0 0 0-384 384v85.333a42.667 42.667 0 1 0 85.334 0V768a298.667 298.667 0 0 1 298.666-298.667h323.67L609.835 652.501a42.667 42.667 0 0 0 60.33 60.331l256-256a42.667 42.667 0 0 0 0-60.33l-256-256a42.667 42.667 0 0 0-60.33 0z' />
  </svg>
)

export default SVG
