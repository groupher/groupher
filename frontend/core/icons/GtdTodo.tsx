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
      <path d='M512 938.667A426.667 426.667 0 1 1 938.667 512 427.136 427.136 0 0 1 512 938.667zm0-731.435A304.768 304.768 0 1 0 816.725 512 305.11 305.11 0 0 0 512 207.232z' />
    </svg>
  )
}

export default SVG
