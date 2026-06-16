import CommentSVG from '~/icons/Comment'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreDot'
import QRCodeSVG from '~/icons/QRCode'

export const FOOTER_TITLE = 'Help us improve the doc'
export const FEEDBACK_TAGS_TITLE = 'What can be improved?'
export const FEEDBACK_NOTE_PLACEHOLDER = '(optional) can you tell us more?'

export const FEEDBACK_TAG_GROUPS = [
  {
    min: 0,
    max: 30,
    labels: [
      '内容不同步',
      '描述不清晰',
      '步骤缺失',
      '示例不可运行',
      '信息过时',
      '和实际界面不一致',
      '链接失效',
      '缺少错误处理',
    ],
  },
  {
    min: 31,
    max: 60,
    labels: [
      '示例不够',
      '步骤不完整',
      '术语不懂',
      '结构混乱',
      '配置不完整',
      '缺少截图',
      '缺少故障排查',
      '需要最佳实践',
    ],
  },
  {
    min: 61,
    max: 90,
    labels: [
      '步骤清楚',
      '示例有用',
      '容易理解',
      '结构清晰',
      '信息完整',
      '截图有帮助',
      '解决了问题',
      '最佳实践有用',
    ],
  },
  {
    min: 91,
    max: 100,
    labels: [
      '非常清楚',
      '很有帮助',
      '示例很棒',
      '解释到位',
      '上手很快',
      '内容及时',
      '体验很好',
      '值得推荐',
    ],
  },
] as const

export const FOOTER_ACTIONS = [
  {
    key: 'comment',
    label: 'Discuss this doc',
    Icon: CommentSVG,
    count: '269',
  },
  {
    key: 'suggest-edit',
    label: 'Suggest edit',
    Icon: EditSVG,
    count: null,
  },
  {
    key: 'share',
    label: 'Share doc',
    Icon: QRCodeSVG,
    count: null,
  },
  {
    key: 'more',
    label: 'More actions',
    Icon: MoreSVG,
    count: null,
  },
] as const
