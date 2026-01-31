export { cn, cnMerge } from '~/css'

export default () => {
  return {
    wrapper: 'relative z-10 inline-block p-0 border-0 bg-transparent align-middle shrink-0',
    notLoaded: '-z-10 opacity-0 absolute',

    // 图片本体：自己决定 cover/contain、圆角等
    img: 'absolute inset-0 z-0 block w-full h-full object-cover',

    // fallback 覆盖层：默认居中（你不想居中就删掉 grid）
    fallbackOverlay: 'grid place-items-center absolute inset-0 z-10',
  }
}
