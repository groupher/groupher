import { type FC, memo, useCallback } from 'react'

import { ICON } from '~/config'
import useTrans from '~/hooks/useTrans'
import MoreSVG from '~/icons/menu/More'
import useCommentModeration from '~/query/mutation/useCommentModeration'
import { authWarn } from '~/signal'
import type { TComment } from '~/spec'
import useAccount from '~/stores/account/hooks'
import MenuButton from '~/ui/Buttons/MenuButton'

import useActions from '../useLogic/useActions'
import useSalon from './salon/actions'

type TProps = {
  data: TComment
}

const Actions: FC<TProps> = ({ data }) => {
  const s = useSalon()
  const { t } = useTrans()

  const accountInfo = useAccount()
  const { openUpdateEditor, openReplyEditor } = useActions()
  const { deleteComment, reportComment } = useCommentModeration(data)

  const menuOptions = [
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
    {
      key: 'report',
      icon: `${ICON}/article/report.svg`,
      title: t('comment.action.report'),
    },
  ]

  let extraOptions = []

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
    (key) => {
      if (!accountInfo.isLogin) return authWarn()

      switch (key) {
        case 'share': {
          return console.log('## todo: share')
        }
        case 'quote': {
          return console.log('## todo: quote')
        }
        case 'report': {
          return reportComment()
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
    [accountInfo.isLogin, data, deleteComment, openUpdateEditor, reportComment],
  )

  return (
    <div className={s.wrapper}>
      {data.meta.isLegal && (
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
      )}

      <div className='grow' />
      <MenuButton options={menuOptions} extraOptions={extraOptions} onClick={handleAction}>
        <MoreSVG className={s.moreIcon} />
      </MenuButton>
    </div>
  )
}

export default memo(Actions)
