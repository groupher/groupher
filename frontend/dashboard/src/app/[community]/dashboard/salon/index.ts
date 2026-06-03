export default function useSalon() {
  return {
    wrapper: 'column-center justify-start min-h-full w-full',
    layoutFrame: (collapsed: boolean) =>
      [
        'w-full transition-[padding] duration-150 ease-out pr-16 xl:pr-20',
        collapsed ? 'pl-0' : 'pl-20 xl:pl-36',
      ].join(' '),
    inner: 'row w-full mt-7 min-h-screen',
    sideMenuClip: (collapsed: boolean) =>
      [
        'shrink-0 overflow-hidden transition-[width] duration-150 ease-out',
        collapsed ? 'w-14' : 'w-40',
      ].join(' '),
    sideMenuMotion: 'shrink-0',
    children: 'column items-center grow bg-transparent min-w-0',
  }
}
