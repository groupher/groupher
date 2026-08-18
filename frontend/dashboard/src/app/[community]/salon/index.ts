export default function useSalon() {
  return {
    wrapper: 'column-center justify-start min-h-full w-full',
    layoutFrame: 'container-dashboard relative w-full transition-all duration-150 ease-out',
    inner: 'row w-full mt-7 min-h-screen',
    sideMenuClip: 'shrink-0 self-stretch overflow-visible transition-all duration-150 ease-out',
    children: 'column items-center grow bg-transparent min-w-0',
  }
}
