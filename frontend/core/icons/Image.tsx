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
      <path d='M768 128H256a128 128 0 0 0-128 128v512a128 128 0 0 0 128 128h512a128 128 0 0 0 128-128V256a128 128 0 0 0-128-128zm-512 85.333h512A42.667 42.667 0 0 1 810.667 256v356.693l-136.534-116.48a118.187 118.187 0 0 0-150.186 0L213.333 755.2V256A42.667 42.667 0 0 1 256 213.333z' />
      <path d='M277.333 362.667a64 64 0 1 0 128 0 64 64 0 1 0-128 0Z' />
    </svg>
  )
}

export default SVG
