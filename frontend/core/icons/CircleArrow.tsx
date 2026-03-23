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
      <path d='M1024 512C1024 229.218 794.782 0 512 0S0 229.218 0 512s229.218 512 512 512 512-229.218 512-512zm-944 0C80 273.406 273.406 80 512 80s432 193.406 432 432-193.406 432-432 432S80 750.594 80 512z' />
      <path d='M736 572 512 348 288 572l64 64 160-160 160 160Z' />
    </svg>
  )
}

export default SVG
