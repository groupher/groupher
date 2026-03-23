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
      <path d='M640 192c141.248 0 256 114.752 256 256S781.248 704 640 704H384c-83.488 0-157.888 40.256-204.64 102.496C148.256 783.008 128 745.76 128 704V384c0-105.888 86.24-192 192-192h320m0-128H320C143.264 64 0 207.264 0 384v320c0 141.376 114.752 256 256 256 0-70.752 57.376-128 128-128h256c212.128 0 384-172 384-384S852.128 64 640 64z' />
    </svg>
  )
}

export default SVG
