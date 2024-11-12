/*
 * PostLayout
 */

import { useRouter } from 'next/navigation'

import useMetric from '~/hooks/useMetric'
import useViewingArticle from '~/hooks/useViewingArticle'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import { ARTICLE_THREAD } from '~/const/thread'

// import ArchivedSign from '~/widgets/ArchivedSign'

import ArticleBaseStats from '~/widgets/ArticleBaseStats'
import Share from '~/widgets/Share'
import ArticleSettingMenu from '~/widgets/ArticleSettingMenu'
import ArticlePinLabel from '~/widgets/ArticlePinLabel'

// import ArticleMenu from '~/widgets/ArticleMenu'
// import BackTo from './BackTo'

import {
  Wrapper,
  BackBtnWrapper,
  ArrowIcon,
  LeftPart,
  Topping,
  Title,
  SubTitle,
  Avatar,
  AuthorName,
  BottomInfo,
} from '../styles/post/digest'

export default () => {
  const router = useRouter()
  const metric = useMetric()
  const { article } = useViewingArticle()
  const primaryColor = usePrimaryColor()

  const { innerId, author, title, isPinned } = article

  const backUrl = `/${article.originalCommunitySlug}/${ARTICLE_THREAD.POST}`

  return (
    <Wrapper metric={metric}>
      <LeftPart>
        <Topping>
          <BackBtnWrapper onClick={() => router.push(backUrl)}>
            <ArrowIcon />
            讨论区
          </BackBtnWrapper>
          <div className="grow" />
          <Share modalOffset="38%" />
          <ArticleSettingMenu left={16} />
        </Topping>

        <ArticlePinLabel isPinned={isPinned} top={56} />
        <Title $isPinned={isPinned} $color={primaryColor}>
          {title}
          <SubTitle>{innerId}</SubTitle>
        </Title>
        <BottomInfo>
          <AuthorName href="/">
            <Avatar src={author.avatar} />
            {author.nickname}
          </AuthorName>
          <ArticleBaseStats article={article} right={26} />
        </BottomInfo>
      </LeftPart>
    </Wrapper>
  )
}
