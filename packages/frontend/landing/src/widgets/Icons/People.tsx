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
      <path d="M384 469.333a170.667 170.667 0 1 0-170.667-170.666A170.667 170.667 0 0 0 384 469.333zm341.333 85.334a128 128 0 1 0-128-128 128 128 0 0 0 128 128zM896 853.333a42.667 42.667 0 0 0 42.667-42.666 213.333 213.333 0 0 0-343.894-168.534 298.667 298.667 0 0 0-509.44 211.2A42.667 42.667 0 0 0 128 896h512a42.667 42.667 0 0 0 42.667-42.667" />
    </svg>
  )
}

export default SVG
