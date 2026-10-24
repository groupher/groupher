import { type FC, memo, useCallback } from 'react'

import { ICON } from '~/config'
import useTrans from '~/hooks/useTrans'
import MoreSVG from '~/icons/menu/More'
import useCommentModeration from '~/query/mutation/useCommentModeration'
import { authWarn } from '~/signal'
import type { TComment, TMenuOption } from '~/spec'
import useAccount from '~/stores/account/hooks'
import MenuButton from '~/ui/Buttons/MenuButton'
import ReportAction from '~/unit/AlertWall/ReportAction'
import { useCommentFeed } from '~/unit/Comments/pagination/context'

import useActions from '../useLogic/useActions'
import useSalon from './salon/actions'

type TProps = {
  data: TComment
}

const Actions: FC<TProps> = ({ data }) => {
  const s = useSalon()
  const { t } = useTrans()

  const accountInfo = useAccount()
  const { collection } = useCommentFeed()
  const { openUpdateEditor, openReplyEditor } = useActions()
  const { deleteComment } = useCommentModeration(data)
  const article = collection.article
  const reportTarget =
    article?.innerId && article.thread
      ? {
          type: 'COMMENT' as const,
          comment: {
            article,
            innerId: data.innerId,
          },
        }
      : null

  const menuOptions: TMenuOption[] = [
    // {
    //   key: 'quote',
    //   icon: `${ICON}/shape/quote.svg`,
    //   title: t('comment.action.quote'),
    // },
    {
      key: 'share',
      icon: `${ICON}/article/share.svg`,
      title: t('comment.action.share'),
    },
  ]

  let extraOptions: TMenuOption[] = []

  if (data.author?.login === accountInfo?.user?.login) {
    extraOptions = [
      {
        key: 'edit',
        icon: `${ICON}/edit/publish-pen.svg`,
        title: t('comment.action.edit'),
      },
      {
        key: 'delete',
        icon: `${ICON}/shape/delete.svg`,
        title: t('comment.action.delete'),
      },
    ]
  }

  const handleAction = useCallback(
    (key?: string) => {
      if (!accountInfo.isLogin) return authWarn()

      switch (key) {
        case 'share': {
          return console.log('## todo: share')
        }
        case 'quote': {
          return console.log('## todo: quote')
        }
        case 'edit': {
          return openUpdateEditor(data)
        }
        case 'delete': {
          return deleteComment()
        }
        default: {
          return
        }
      }
    },
    [accountInfo.isLogin, data, deleteComment, openUpdateEditor],
  )

  return (
    <div className={s.wrapper}>
      {reportTarget && <ReportAction target={reportTarget} />}
      <button
        type='button'
        className={s.replyAction}
        onClick={() => {
          if (!accountInfo.isLogin) return authWarn()

          openReplyEditor(data)
        }}
      >
        {t('comment.action.reply')}
      </button>

      <div className='grow' />
      <MenuButton options={menuOptions} extraOptions={extraOptions} onClick={handleAction}>
        <MoreSVG className={s.moreIcon} />
      </MenuButton>
    </div>
  )
}

export default memo(Actions)
