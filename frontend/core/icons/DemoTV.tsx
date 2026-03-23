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
      <path d='M170.667 682.667H256A42.667 42.667 0 0 1 256 768H128a42.667 42.667 0 0 1-42.667-42.667v-512A42.667 42.667 0 0 1 128 170.667h768a42.667 42.667 0 0 1 42.667 42.666v512A42.667 42.667 0 0 1 896 768H768a42.667 42.667 0 0 1 0-85.333h85.333V256H170.667v426.667zm243.498 158.165a42.667 42.667 0 1 1-60.33-60.33l128-128a42.667 42.667 0 0 1 60.33 0l128 128a42.667 42.667 0 0 1-60.33 60.33L512 742.997l-97.835 97.835z' />
    </svg>
  )
}

export default SVG
