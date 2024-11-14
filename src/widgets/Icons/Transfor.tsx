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
      <path d="M96 384h832c12.8 0 25.6-6.4 32-19.2s0-25.6-6.4-32l-192-192c-12.8-12.8-32-12.8-44.8 0s-12.8 32 0 44.8L851.2 320H96c-19.2 0-32 12.8-32 32s12.8 32 32 32zm832 256H96c-12.8 0-25.6 6.4-32 19.2-6.4 12.8 0 25.6 6.4 32l192 192C268.8 896 281.6 896 288 896s19.2 0 25.6-6.4c12.8-12.8 12.8-32 0-44.8L172.8 704H928c19.2 0 32-12.8 32-32s-12.8-32-32-32z" />
    </svg>
  )
}

export default SVG
