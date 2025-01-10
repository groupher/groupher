/* eslint-disable react/jsx-no-comment-textnodes */
import { type FC, memo, Fragment } from 'react'
import TimeAgo from 'timeago-react'

import type { TComment } from '~/spec'

import { Space } from '~/widgets/Common'

import {
  FloorNum,
  CreateDate,
  HeaderBaseInfo,
  BaseInfo,
  AuthorTitle,
  AuthorName,
  ArticleBase,
} from '../../styles/comment/header/user_published'

type TProps = {
  data: TComment
}

const CommentHeader: FC<TProps> = ({ data }) => {
  const { article } = data

  return (
    <Fragment>
      <HeaderBaseInfo>
        <BaseInfo>
          <ArticleBase>
            <AuthorTitle href={`/${article.thread}/${article.id}`} prefetch={false}>
              {article.title}
            </AuthorTitle>
          </ArticleBase>
          <FloorNum>
            #<Space right={2} />
            {data.floor}
          </FloorNum>
          <Space right={10} />
        </BaseInfo>
        <AuthorName href={`/u/${article.author.login}`} prefetch={false}>
          {article.author.nickname}
        </AuthorName>

        <CreateDate>
          评论于: <TimeAgo datetime={data.insertedAt} locale="zh_CN" />
        </CreateDate>
      </HeaderBaseInfo>
    </Fragment>
  )
}

export default memo(CommentHeader)
