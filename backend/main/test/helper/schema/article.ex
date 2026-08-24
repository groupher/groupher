defmodule GroupherServer.Test.Helper.Schema.Article do
  @moduledoc "GraphQL documents used by article tests."

  def m(:trash_article) do
    """
    mutation($article: ArticlePathInput!) {
      trashArticle(article: $article) {
        id
        thread
        articleRef
        article {
          innerId
          title
        }
        deletedAt
        scheduledPermanentDeletionAt
      }
    }
    """
  end

  def m(:restore_trashed_article) do
    """
    mutation($id: ID!, $community: String!, $thread: Thread!) {
      restoreTrashedArticle(id: $id, community: $community, thread: $thread) {
        innerId
        title
      }
    }
    """
  end

  def m(:permanently_delete_trashed_article) do
    """
    mutation($id: ID!, $community: String!, $thread: Thread!) {
      permanentlyDeleteTrashedArticle(id: $id, community: $community, thread: $thread) {
        done
      }
    }
    """
  end

  def m(:set_post_cat) do
    """
    mutation(
          $article: ArticlePathInput!
          $cat: ArticleCatEnum!
        ) {
          setPostCat(
            article: $article
            cat: $cat
          ) {
            innerId
            cat
          }
        }
    """
  end

  def m(:move_to_blackhole) do
    """
    mutation($article: ArticlePathInput!, $communityTags: [ID]) {
      moveToBlackhole(article: $article, communityTags: $communityTags) {
        innerId
      }
    }
    """
  end

  def m(:move_article) do
    """
    mutation($article: ArticlePathInput!, $targetCommunity: String!, $communityTags: [ID]) {
      moveArticle(article: $article, targetCommunity: $targetCommunity, communityTags: $communityTags) {
        innerId
      }
    }
    """
  end

  def m(:unmirror_article) do
    """
    mutation($article: ArticlePathInput!, $targetCommunity: String!) {
      unmirrorArticle(article: $article, targetCommunity: $targetCommunity) {
        innerId
      }
    }
    """
  end

  def m(:mirror_article) do
    """
    mutation($article: ArticlePathInput!, $targetCommunity: String!, $communityTags: [ID]) {
        mirrorArticle(article: $article, targetCommunity: $targetCommunity, communityTags: $communityTags) {
          innerId
        }
      }
    """
  end

  def m(:mirror_to_home) do
    """
    mutation($article: ArticlePathInput!, $communityTags: [ID]) {
      mirrorToHome(article: $article, communityTags: $communityTags) {
        innerId
      }
    }
    """
  end

  def m(:set_community_tag) do
    """
    mutation($article: ArticlePathInput!, $communityTagId: ID!) {
      setCommunityTag(article: $article, communityTagId: $communityTagId) {
        innerId
      }
    }
    """
  end

  def m(:set_post_status) do
    """
    mutation(
          $article: ArticlePathInput!
          $status: ArticleStatusEnum!
        ) {
          setPostStatus(
            article: $article
            status: $status
          ) {
            innerId
            status
          }
        }
    """
  end

  def m(:unset_community_tag) do
    """
    mutation($article: ArticlePathInput!, $communityTagId: ID!) {
      unsetCommunityTag(article: $article, communityTagId: $communityTagId) {
        innerId
        title
      }
    }
    """
  end

  def m(:undo_upvote_article, thread) do
    """
    mutation($article: ArticlePathInput!) {
      undoUpvote#{t(thread)}(article: $article) {
        innerId
        meta {
          latestUpvotedUsers {
            login
          }
        }
      }
    }
    """
  end

  def m(:sink_article, thread) do
    """
    mutation($article: ArticlePathInput!){
      sink#{t(thread)}(article: $article) {
        innerId
      }
    }
    """
  end

  def m(:undo_sink_article, thread) do
    """
    mutation($article: ArticlePathInput!){
      undoSink#{t(thread)}(article: $article) {
        innerId
      }
    }
    """
  end

  def m(:lock_comment, thread) do
    """
    mutation($article: ArticlePathInput!) {
      lock#{t(thread)}Comment(article: $article) {
        innerId
        title
      }
    }
    """
  end

  def m(:unlock_comment, thread) do
    """
    mutation($article: ArticlePathInput!){
      undoLock#{t(thread)}Comment(article: $article) {
        innerId
      }
    }
    """
  end

  def m(:report_article, thread) do
    """
    mutation($article: ArticlePathInput!, $reason: String!, $attr: String) {
      report#{t(thread)}(article: $article, reason: $reason, attr: $attr) {
        innerId
        title
      }
    }
    """
  end

  def m(:undo_report_article, thread) do
    """
    mutation($article: ArticlePathInput!) {
      undoReport#{t(thread)}(article: $article) {
        innerId
        title
      }
    }
    """
  end

  def m(:pin_article, thread) do
    """
    mutation($article: ArticlePathInput!){
      pin#{t(thread)}(article: $article) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:undo_pin_article, thread) do
    """
    mutation($article: ArticlePathInput!){
      undoPin#{t(thread)}(article: $article) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:emotion_article, thread) do
    """
    mutation($article: ArticlePathInput!, $emotion: ArticleEmotion!) {
      emotionTo#{t(thread)}(article: $article, emotion: $emotion) {
        innerId
        emotions {
          type
          count
          viewerHasReacted
          latestUsers {
            login
            nickname
          }
        }
      }
    }
    """
  end

  def m(:undo_emotion_article, thread) do
    """
    mutation($article: ArticlePathInput!, $emotion: ArticleEmotion!) {
      undoEmotionTo#{t(thread)}(article: $article, emotion: $emotion) {
        innerId
        emotions {
          type
          count
          viewerHasReacted
          latestUsers {
            login
            nickname
          }
        }
      }
    }
    """
  end

  def m(:create_article_draft, thread) do
    """
    mutation($community: String!, $title: String!, $bodyBag: ArtimentBodyBagInput!) {
      create#{t(thread)}Draft(community: $community, title: $title, bodyBag: $bodyBag) {
        id
        thread
        stage
        title
        version
      }
    }
    """
  end

  def m(:create_article, thread) do
    """
    mutation(
      $title: String!
      $bodyBag: ArtimentBodyBagInput!
      $community: String!
      $communityTags: [ID]
      $linkAddr: String
    ) {
      create#{t(thread)}(
        title: $title
        bodyBag: $bodyBag
        community: $community
        communityTags: $communityTags
        linkAddr: $linkAddr
      ) {
        innerId
        title
        linkAddr
        document {
          html
        }
        community {
          slug
        }
      }
    }
    """
  end

  def m(:update_article_draft, thread) do
    """
    mutation($community: String!, $id: ID!, $expectedVersion: Int!, $title: String, $bodyBag: ArtimentBodyBagInput) {
      update#{t(thread)}Draft(community: $community, id: $id, expectedVersion: $expectedVersion, title: $title, bodyBag: $bodyBag) {
        id
        thread
        stage
        title
        version
      }
    }
    """
  end

  def m(:publish_article_draft, thread) do
    """
    mutation($community: String!, $id: ID!) {
      publish#{t(thread)}Draft(community: $community, id: $id) {
        innerId
        title
      }
    }
    """
  end

  def m(:update_article, thread) do
    """
    mutation($article: ArticlePathInput!, $expectedVersion: Int!, $title: String, $bodyBag: ArtimentBodyBagInput, $copyRight: String, $communityTags: [ID]){
      update#{t(thread)}(article: $article, expectedVersion: $expectedVersion, title: $title, bodyBag: $bodyBag, copyRight: $copyRight, communityTags: $communityTags) {
        innerId
        version
        title
        document {
          html
        }
        copyRight
        meta {
          isEdited
        }
        commentsParticipants {
          login
          nickname
        }
        communityTags {
          id
        }
      }
    }
    """
  end

  def m(:upvote_article, thread) do
    """
    mutation($article: ArticlePathInput!) {
      upvote#{t(thread)}(article: $article) {
        innerId
        meta {
          latestUpvotedUsers {
            login
          }
        }
        upvotesCount
      }
    }
    """
  end

  def m(:create_document, operation) do
    """
    mutation($title: String!, $bodyBag: ArtimentBodyBagInput!, $community: String!) {
      #{operation}(title: $title, bodyBag: $bodyBag, community: $community) {
        innerId
        title
        document {
          json
          markdown
          markdownToc
          html
        }
      }
    }
    """
  end

  def m(:update_document, operation) do
    """
    mutation($article: ArticlePathInput!, $title: String, $bodyBag: ArtimentBodyBagInput) {
      #{operation}(article: $article, title: $title, bodyBag: $bodyBag) {
        innerId
        title
        document {
          json
          markdown
          markdownToc
          html
        }
      }
    }
    """
  end

  def m(:update_draft_document, operation) do
    """
    mutation($community: String!, $id: ID!, $expectedVersion: Int!, $title: String, $bodyBag: ArtimentBodyBagInput) {
      #{operation}(community: $community, id: $id, expectedVersion: $expectedVersion, title: $title, bodyBag: $bodyBag) {
        id
        version
        title
        document {
          json
          markdown
          markdownToc
          html
        }
      }
    }
    """
  end

  def m(:create_cover, thread) do
    thread_name = thread |> to_string() |> String.capitalize()

    """
    mutation(
      $title: String!
      $bodyBag: ArtimentBodyBagInput!
      $community: String!
      $coverUrl: String
      $coverUrlDark: String
      $coverEditInfo: CoverEditInfoInput
    ) {
      create#{thread_name}(
        title: $title
        bodyBag: $bodyBag
        community: $community
        coverUrl: $coverUrl
        coverUrlDark: $coverUrlDark
        coverEditInfo: $coverEditInfo
      ) {
        innerId
        version
        coverUrl
        coverUrlDark
        coverEditInfo {
          id
          canvasWidth
          canvasHeight
          light {
            background {
              id
              type
            }
            images
          }
          dark {
            background {
              id
              type
            }
            images
          }
        }
      }
    }
    """
  end

  def m(:update_cover, thread) do
    thread_name = thread |> to_string() |> String.capitalize()

    """
    mutation(
      $article: ArticlePathInput!
      $expectedVersion: Int!
      $coverUrl: String
      $coverUrlDark: String
      $coverEditInfo: CoverEditInfoInput
    ) {
      update#{thread_name}(
        article: $article
        expectedVersion: $expectedVersion
        coverUrl: $coverUrl
        coverUrlDark: $coverUrlDark
        coverEditInfo: $coverEditInfo
      ) {
        innerId
        version
        coverUrl
        coverUrlDark
        coverEditInfo {
          id
          canvasWidth
          canvasHeight
          light {
            background {
              id
              type
            }
            images
          }
        }
      }
    }
    """
  end

  def q(:trashed_articles) do
    """
    query($community: String!, $thread: Thread!, $filter: TrashFilter) {
      trashedArticles(community: $community, thread: $thread, filter: $filter) {
        entries {
          id
          thread
          articleRef
          mentionedByCount
          article {
            innerId
            title
          }
          mentionedBy(filter: {page: 1, size: 20}) {
            totalCount
          }
          mentions(filter: {page: 1, size: 20}) {
            totalCount
          }
        }
        totalCount
      }
    }
    """
  end

  def q(:collected_users) do
    """
    query($article: ArticlePathInput!, $filter: PagiFilter!) {
      collectedUsers(article: $article, filter: $filter) {
        entries {
          login
          avatar
          nickname
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
  end

  def q(:grouped_kanban_posts) do
    """
    query($community: String!) {
          groupedKanbanPosts(community: $community) {
            backlog {
              entries {
                innerId
                cat
                status
                title
              }
              totalPages
              totalCount
              pageSize
              pageNumber
            }

            todo {
              entries {
                innerId
                cat
                status
                title
              }
              totalPages
              totalCount
              pageSize
              pageNumber
            }

            wip {
              entries {
                innerId
                cat
                status
                title
              }
              totalPages
              totalCount
              pageSize
              pageNumber
            }

            done {
              entries {
                innerId
                cat
                status
                title
              }
              totalPages
              totalCount
              pageSize
              pageNumber
            }

            rejected {
              entries {
                innerId
                cat
                status
                title
              }
              totalPages
              totalCount
              pageSize
              pageNumber
            }
          }
        }
    """
  end

  def q(:paged_kanban_posts) do
    """
    query($community: String!, $filter: PagedKanbanPostsFilter!) {
          pagedKanbanPosts(community: $community, filter: $filter) {
            entries {
              innerId
              cat
              status
              title
            }
            totalPages
            totalCount
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:upvoted_users) do
    """
    query($article: ArticlePathInput!, $filter: PagiFilter!) {
      upvotedUsers(article: $article, filter: $filter) {
        entries {
          login
          avatar
          nickname
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
  end

  def q(:article_logs) do
    """
    query($article: ArticlePathInput!, $filter: ArticleLogFilter) {
      articleLogs(article: $article, filter: $filter) {
        entries {
          id
          action
          actor { type id nickname avatar }
          subject { type ref title innerId }
          target { type ref title innerId }
          payload
          occurredAt
        }
        pageNumber
        pageSize
        totalCount
        totalPages
      }
    }
    """
  end

  def q(key, thread, extra \\ "")

  def q(:paged_published_articles, thread, extra) do
    """
    query($login: String!, $filter: PagiFilter!) {
      pagedPublished#{t(thread)}s(login: $login, filter: $filter) {
        entries {
          innerId
          title
          author {
            login
          }
          #{extra}
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
  end

  def q(:article, thread, extra) do
    """
    query($article: ArticlePathInput!) {
      #{thread}(article: $article) {
        title
        innerId
        community {
          slug
        }
        meta {
          isEdited
          isLegal
          illegalReason
          illegalWords
        }
        commentsParticipants {
          login
          nickname
        }
        commentsParticipantsCount
        #{extra}
      }
    }
    """
  end

  def q(:paged_articles, thread, extra) do
    """
    query($filter: Paged#{t(thread)}sFilter!) {
      paged#{t(thread)}s(filter: $filter) {
        entries {
          innerId
          title
          views
          upvotesCount
          commentsCount
          viewerHasCollected
          viewerHasUpvoted
          viewerHasViewed
          viewerHasReported
          isPinned
          pending
          meta {
            latestUpvotedUsers {
              login
            }
          }
          author {
            login
            nickname
            avatar
          }
          document {
            html
          }
          communities {
            slug
          }
          communityTags {
            id
          }
          insertedAt
          activeAt
          #{extra}
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
  end

  def q(:document, field_name, _extra) do
    """
    query($article: ArticlePathInput!) {
      #{field_name}(article: $article) {
        innerId
        title
        document {
          json
          markdown
          markdownToc
          html
        }
      }
    }
    """
  end

  def q(:search_artiments, _thread, extra) do
    """
    query($query: SearchArtimentsQueryInput!) {
      searchArtiments(query: $query) {
        entries {
          artiment {
            ... on ArticleSearchArtiment {
              ref
              type
              title
              communityRef
              thread
              articleRef
              locator {
                community
                thread
                innerId
              }
              #{extra}
            }
          }
          highlights {
            field
            fragments
          }
        }
        totalCount
        totalPages
        pageSize
        pageNumber
      }
    }
    """
  end

  defp t(thread), do: thread |> Atom.to_string() |> String.capitalize()
end
