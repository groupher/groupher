export const PASSPORT_SCOPE = {
  GLOBAL: 'global',
  CMS: 'cms',
} as const

export const PASSPORT_THREADS = ['post', 'blog', 'changelog', 'doc']

export const STACKED_RULE_GROUPS = [
  {
    id: 'tag-management',
    titleKey: 'passport.stacked.manage_tags',
    fallbackTitle: 'Manage tags',
    match: (rule: string) => rule.includes('community_tag.'),
  },
]
