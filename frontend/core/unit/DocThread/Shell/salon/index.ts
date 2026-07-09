export default function useSalon() {
  return {
    wrapper: 'relative mx-auto w-full max-w-7xl pt-10 pb-24',
    articleToc: 'absolute inset-y-0 right-0 z-10 pointer-events-none',
    articleTocSticky: 'sticky top-56 w-8 pointer-events-auto',
    mobileWrapper: 'w-full px-4 pt-6 pb-20',
    panelGroup: 'min-h-screen w-full min-w-0 overflow-visible',
    sidePanel: 'min-h-screen overflow-visible',
    contentPanel: 'min-h-screen min-w-0 overflow-visible',
    contentRail: 'w-full min-w-0 pl-10 pr-0',
    mobileTree: 'mb-8',
    mobileContent: 'w-full min-w-0',
  }
}
