import type { ComponentType, SVGProps } from 'react'

import CommentSVG from '~/icons/Comment'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreDot'
import QRCodeSVG from '~/icons/QRCode'
import type { TTransKey } from '~/spec'

type TFooterAction = {
  key: string
  label: TTransKey
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  count: string | null
}

export const FOOTER_TITLE_I18N_KEY = 'dsb.cms.docs.footer.help_us_improve'
export const FEEDBACK_TAGS_TITLE_I18N_KEY = 'dsb.cms.docs.feedback_tags.title'
export const FEEDBACK_NOTE_PLACEHOLDER_I18N_KEY = 'dsb.cms.docs.feedback_tags.note_placeholder'

export const FEEDBACK_TAG_GROUPS: readonly {
  min: number
  max: number
  labels: readonly TTransKey[]
}[] = [
  {
    min: 0,
    max: 30,
    labels: [
      'dsb.cms.docs.feedback_tags.outdated',
      'dsb.cms.docs.feedback_tags.unclear',
      'dsb.cms.docs.feedback_tags.missing_steps',
      'dsb.cms.docs.feedback_tags.example_broken',
      'dsb.cms.docs.feedback_tags.info_stale',
      'dsb.cms.docs.feedback_tags.ui_mismatch',
      'dsb.cms.docs.feedback_tags.dead_link',
      'dsb.cms.docs.feedback_tags.missing_error_handling',
    ],
  },
  {
    min: 31,
    max: 60,
    labels: [
      'dsb.cms.docs.feedback_tags.not_enough_examples',
      'dsb.cms.docs.feedback_tags.incomplete_steps',
      'dsb.cms.docs.feedback_tags.terms_unclear',
      'dsb.cms.docs.feedback_tags.messy_structure',
      'dsb.cms.docs.feedback_tags.incomplete_config',
      'dsb.cms.docs.feedback_tags.missing_screenshots',
      'dsb.cms.docs.feedback_tags.missing_troubleshooting',
      'dsb.cms.docs.feedback_tags.need_best_practice',
    ],
  },
  {
    min: 61,
    max: 90,
    labels: [
      'dsb.cms.docs.feedback_tags.clear_steps',
      'dsb.cms.docs.feedback_tags.useful_examples',
      'dsb.cms.docs.feedback_tags.easy_to_understand',
      'dsb.cms.docs.feedback_tags.clear_structure',
      'dsb.cms.docs.feedback_tags.complete_info',
      'dsb.cms.docs.feedback_tags.helpful_screenshots',
      'dsb.cms.docs.feedback_tags.solved_problem',
      'dsb.cms.docs.feedback_tags.useful_best_practice',
    ],
  },
  {
    min: 91,
    max: 100,
    labels: [
      'dsb.cms.docs.feedback_tags.very_clear',
      'dsb.cms.docs.feedback_tags.very_helpful',
      'dsb.cms.docs.feedback_tags.great_examples',
      'dsb.cms.docs.feedback_tags.well_explained',
      'dsb.cms.docs.feedback_tags.fast_onboarding',
      'dsb.cms.docs.feedback_tags.timely_content',
      'dsb.cms.docs.feedback_tags.good_experience',
      'dsb.cms.docs.feedback_tags.recommendable',
    ],
  },
]

export const FOOTER_ACTIONS: readonly TFooterAction[] = [
  {
    key: 'comment',
    label: 'dsb.cms.docs.editor.footer.discuss',
    Icon: CommentSVG,
    count: '269',
  },
  {
    key: 'suggest-edit',
    label: 'dsb.cms.docs.editor.footer.suggest_edit',
    Icon: EditSVG,
    count: null,
  },
  {
    key: 'share',
    label: 'dsb.cms.docs.editor.footer.share',
    Icon: QRCodeSVG,
    count: null,
  },
  {
    key: 'more',
    label: 'dsb.cms.docs.editor.footer.more_actions',
    Icon: MoreSVG,
    count: null,
  },
]
