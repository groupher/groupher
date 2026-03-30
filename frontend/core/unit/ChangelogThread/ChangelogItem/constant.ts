import { COLOR } from '~/const/colors'
import type { TEmotion } from '~/spec'

export const demoTags = [
  {
    title: 'Bug 修复',
    slug: 'fix',
    color: COLOR.GREEN,
  },
  {
    title: '新功能',
    slug: 'feature',
    color: COLOR.PURPLE,
  },
]

export const demoEmotion: TEmotion[] = [
  {
    type: 'BEER',
    count: 2,
    viewerHasReacted: false,
    latestUsers: [
      {
        login: 'porter172',
        nickname: 'Immanuel172',
        bio: null,
        shortbio: null,
        avatar: null,
      },
      {
        login: 'cp_bot',
        nickname: 'botman',
        bio: null,
        shortbio: null,
        avatar: null,
      },
    ],
  },
  {
    type: 'DOWNVOTE',
    count: 0,
    viewerHasReacted: false,
    latestUsers: [],
  },
  {
    type: 'HEART',
    count: 0,
    viewerHasReacted: false,
    latestUsers: [],
  },
  {
    type: 'PILL',
    count: 0,
    viewerHasReacted: false,
    latestUsers: [],
  },
  {
    type: 'POPCORN',
    count: 0,
    viewerHasReacted: false,
    latestUsers: [],
  },
]
