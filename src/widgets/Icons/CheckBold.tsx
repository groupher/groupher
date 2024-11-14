import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      className="icon"
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      width={200}
      height={200}
      {...props}
    >
      <path d="M913.017 237.02c-25.311-25.312-66.349-25.312-91.66 0L408.882 649.494 202.645 443.257c-25.312-25.312-66.35-25.312-91.661 0s-25.312 66.35 0 91.66l252.067 252.067c.729.73 1.439 1.402 2.134 2.029 25.434 23.257 64.913 22.585 89.527-2.029l458.303-458.303c25.313-25.312 25.313-66.35.001-91.661z" />
    </svg>
  )
}

export default SVG
