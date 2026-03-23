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
      <path d='M512 271.825a31.03 31.03 0 0 1 31.03 31.03v589.577a31.03 31.03 0 1 1-62.06 0V302.856a31.03 31.03 0 0 1 31.03-31.03z' />
      <path d='M490.062 280.917a31.03 31.03 0 0 1 43.876 0L813.211 560.19a31.03 31.03 0 0 1-43.877 43.908L512 346.764 254.666 604.098a31.03 31.03 0 0 1-43.877-43.908l279.273-279.273zM139.636 178.735a31.03 31.03 0 0 1 31.03-31.03h682.667a31.03 31.03 0 1 1 0 62.06H170.667a31.03 31.03 0 0 1-31.03-31.03z' />
    </svg>
  )
}

export default SVG
