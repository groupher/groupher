import type { FC } from 'react'

import SVG from '~/const/svg'

import UpvoteIcon from './Upvote'
import EditPenIcon from './EditPen'
import LockIcon from './Lock'
import Emotion from './Emotion'
import CommentIcon from './Comment'

import ActivityIcon from './article/Activity'
import ArchivedIcon from './article/Archived'

import CloseCrossIcon from './CloseLight'
import AirBalloonIcon from './AirBalloon'
import CollectionIcon from './CollectionBookmark'

import ShareIcon from './Share'

// social
import WechatIcon from './social/WeChat'
import EmailIcon from './social/Email'

// Menu
import CopyIcon from './menu/Copy'
import MoreLIcon from './menu/MoreL'
import MoreIcon from './menu/More'
import MoreDotIcon from './menu/MoreDot'
import QRCodeIcon from './menu/QRCode'
import ReportIcon from './menu/Report'

//
import LightIcon from './Light'
import BugIcon from './Bug'
import QuestionIcon from './Question'

import DesktopIcon from './Desktop'
import MobileIcon from './Mobile'

export const getLocalSVG = (type: string): FC => {
  switch (type) {
    case SVG.DESKTOP: {
      return DesktopIcon
    }

    case SVG.MOBILE: {
      return MobileIcon
    }

    case SVG.FEATURE: {
      return LightIcon
    }

    case SVG.BUG: {
      return BugIcon
    }

    case SVG.QUESTION: {
      return QuestionIcon
    }

    case SVG.REPORT: {
      return ReportIcon
    }

    case SVG.QR_CODE: {
      return QRCodeIcon
    }

    case SVG.MOREL_DOT: {
      return MoreDotIcon
    }

    case SVG.COPY: {
      return CopyIcon
    }

    case SVG.EMAIL: {
      return EmailIcon
    }

    case SVG.WECHAT: {
      return WechatIcon
    }

    case SVG.UPVOTE: {
      return UpvoteIcon
    }

    case SVG.EDIT_PEN: {
      return EditPenIcon
    }

    case SVG.LOCK: {
      return LockIcon
    }

    case SVG.COLLECTION: {
      return CollectionIcon
    }

    case SVG.SHARE: {
      return ShareIcon
    }

    case SVG.ARCHIVED: {
      return ArchivedIcon
    }

    case SVG.ACTIVITY: {
      return ActivityIcon
    }

    case SVG.CLOSE: {
      return CloseCrossIcon
    }

    case SVG.TO_TOP: {
      return AirBalloonIcon
    }

    case SVG.EMOTION: {
      return Emotion
    }
    case SVG.COMMENT: {
      return CommentIcon
    }
    case SVG.MOREL: {
      return MoreLIcon
    }
    case SVG.MORE: {
      return MoreIcon
    }
    default: {
      return UpvoteIcon
    }
  }
}

export const holder = 1
