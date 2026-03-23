import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      className='icon'
      viewBox='0 0 1024 1024'
      xmlns='http://www.w3.org/2000/svg'
      width={200}
      height={200}
      {...props}
    >
      <path d='M597.333 960 477.867 810.667H256A42.667 42.667 0 0 1 213.333 768V303.061A42.667 42.667 0 0 1 256 260.395h682.667a42.667 42.667 0 0 1 42.666 42.666V768a42.667 42.667 0 0 1-42.666 42.667H716.8L597.333 960zm78.464-234.667H896V345.728H298.667v379.605h220.202l78.464 98.048 78.464-98.048zm-590.464-640h725.334v85.334H128V640H42.667V128a42.667 42.667 0 0 1 42.666-42.667z' />
    </svg>
  )
}

export default SVG
