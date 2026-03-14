import type { SVGProps } from 'react'

const SVG = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={28}
      height={24}
      viewBox="0 0 28 24"
      fill="none"
      {...props}
    >
      <path
        d="M1 1v8c0 5.523 4.477 10 10 10h16"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default SVG
