import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={200}
      height={200}
      className='icon'
      viewBox='0 0 1024 1024'
      {...props}
    >
      <path d='M660.459 119.467C614.336 89.173 559.7 85.333 512 85.333c-47.616 0-102.379 3.84-148.459 34.134C295.125 163.84 256 170.667 256 378.027v560.64h512v-560.64c0-207.36-39.253-214.187-107.541-258.56zM548.587 704h-73.174V384H384v-85.333h91.413V192h73.174v106.667H640V384h-91.413v320z' />
      <path d='M85.333 938.667h853.334S725.333 768 512 768 85.333 938.667 85.333 938.667z' />
    </svg>
  )
}

export default SVG
