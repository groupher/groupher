import { memo, type SVGProps } from 'react'

const Star = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={200}
      height={200}
      className="icon"
      viewBox="0 0 1024 1024"
      {...props}
    >
      <path d="M384 334.08V512h128a128 128 0 0 0 128-128v-49.92a128.043 128.043 0 1 1 85.333 0V384A213.333 213.333 0 0 1 512 597.333H384v92.587a128.043 128.043 0 1 1-85.333 0V334.08a128.043 128.043 0 1 1 85.333 0zm-42.667 519.253a42.667 42.667 0 1 0 0-85.333 42.667 42.667 0 0 0 0 85.333zM682.667 256a42.667 42.667 0 1 0 0-85.333 42.667 42.667 0 0 0 0 85.333zm-341.334 0a42.667 42.667 0 1 0 0-85.333 42.667 42.667 0 0 0 0 85.333z" />
    </svg>
  )
}

export default memo(Star)
