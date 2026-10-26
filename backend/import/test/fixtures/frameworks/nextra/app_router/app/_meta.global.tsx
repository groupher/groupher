const GUIDE = {
  index: '',
  gettingStarted: '',
  _: {
    type: 'separator',
    title: 'More',
  },
  external: {
    title: <span className='badge'>External Guide</span>,
    href: 'https://example.com/guide',
  },
}

export default {
  index: {
    type: 'page',
    display: 'hidden',
  },
  docs: {
    type: 'page',
    title: 'Documentation',
    items: GUIDE,
  },
  api: {
    type: 'page',
  },
  versions: {
    type: 'menu',
    items: {
      old: { title: 'Old Docs', href: 'https://example.com/v3' },
    },
  },
}
