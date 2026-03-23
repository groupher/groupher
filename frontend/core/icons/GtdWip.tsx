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
      <path d='M512 213.333A298.667 298.667 0 1 1 213.333 512 298.667 298.667 0 0 1 512 213.333M512 128a384 384 0 1 0 384 384 384 384 0 0 0-384-384zm213.333 384A213.333 213.333 0 0 0 512 298.667V512L361.173 662.827A213.333 213.333 0 0 0 725.333 512z' />
    </svg>
  )
}

export default SVG
