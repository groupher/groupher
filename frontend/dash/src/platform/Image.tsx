import type { TPlatformImageProps } from '~/platform'

const resolveSrc = (src: TPlatformImageProps['src']): string =>
  typeof src === 'string' ? src : src.src

export default function NativePlatformImage({
  fill,
  priority,
  src,
  style,
  unoptimized: _unoptimized,
  ...props
}: TPlatformImageProps) {
  return (
    <img
      {...props}
      src={resolveSrc(src)}
      style={fill ? { height: '100%', objectFit: 'cover', width: '100%', ...style } : style}
      {...(priority ? { fetchPriority: 'high' as const } : {})}
    />
  )
}
