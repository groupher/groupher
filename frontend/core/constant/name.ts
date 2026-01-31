import { FIELDS } from '~/stores/dashboard/constant'

export { ALIAS_GROUP, BUILTIN_ALIAS } from './builtin-alias'

export const HOME_COMMUNITY = {
  home: 'groupher',
  slug: 'home',
  logo: '/groupher.png',
}

const LANDING_COMMUNITY = {
  slug: 'landing',
  homepage: '',
  desc: '',
  meta: { postsCount: 0, docsCount: 0, blogsCount: 0, changelogsCount: 0 },
  // dashboard: {
  //   ...FIELDS,
  //   original: FIELDS,
  // },
}

export const LANDING_INIT_DATA = {
  community: LANDING_COMMUNITY,
  dashboard: {
    ...FIELDS,
    original: FIELDS,
  },
}
