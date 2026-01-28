export { cn } from '~/css'

export default () => {
  return {
    wrapper: 'relative opacity-100 z-10',
    notLoaded: '-z-10 opacity-0 absolute',
  }
}
