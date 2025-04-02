defmodule GroupherServer.Test.Helper.Schema do
  @moduledoc false

  def q(key, thread, extra \\ "")

  def q(:article, thread, extra) do
    """
    query($community: String!, $id: ID!) {
      #{thread}(community: $community, id: $id) {
        title
        innerId
        originalCommunitySlug
        meta {
          isEdited
          isLegal
          illegalReason
          illegalWords
        }
        commentsParticipants {
          id
          nickname
        }
        commentsParticipantsCount
        isArchived
        archivedAt
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
            id
            nickname
            avatar
          }
          document {
            bodyHtml
          }
          communities {
            id
            slug
          }
          articleTags {
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

  def q(:paged_published_articles, thread, extra) do
    """
    query($login: String!, $filter: PagiFilter!) {
      pagedPublished#{t(thread)}s(login: $login, filter: $filter) {
        entries {
          innerId
          title
          author {
            id
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

  def q(:search_articles, thread, extra) do
    """
    query($title: String!) {
      search#{t(thread)}s(title: $title) {
        entries {
          innerId
          title
          #{extra}
        }
        totalCount
      }
    }
    """
  end

  def q(:paged_published_comments) do
    """
    query($login: String!, $thread: Thread, $filter: PagiFilter!) {
      pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {
        entries {
          id
          bodyHtml
          author {
            id
          }
          article {
            id
            title
            thread
            author {
              nickname
              login
            }
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
  end

  def q(:paged_citing_contents) do
    """
    query($content: Content!, $id: ID!, $filter: PagiFilter!) {
      pagedCitingContents(id: $id, content: $content, filter: $filter) {
        entries {
          id
          title
          user {
            login
            nickname
            avatar
          }
          commentId
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
  end

  def q(:search_communities) do
    """
    query($title: String!, $category: String) {
      searchCommunities(title: $title, category: $category) {
        entries {
          id
          title
        }
        totalCount
      }
    }
    """
  end

  def q(:upvoted_users) do
    """
    query(
      $id: ID!
      $community: String!
      $thread: Thread
      $filter: PagiFilter!
    ) {
      upvotedUsers(id: $id, community: $community, thread: $thread, filter: $filter) {
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

  def q(:collected_users) do
    """
    query(
      $id: ID!
      $community: String!
      $thread: Thread
      $filter: PagiFilter!
    ) {
      collectedUsers(id: $id, community: $community, thread: $thread, filter: $filter) {
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

  def m(:pin_article, thread) do
    """
    mutation($id: ID!, $community: String!){
      pin#{t(thread)}(id: $id, community: $community) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:undo_pin_article, thread) do
    """
    mutation($id: ID!, $community: String!){
      undoPin#{t(thread)}(id: $id, community: $community) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:emotion_article, thread) do
    """
    mutation($id: ID!, $community: String!, $emotion: ArticleEmotion!) {
      emotionTo#{t(thread)}(id: $id, community: $community, emotion: $emotion) {
        innerId
        emotions {
          beerCount
          viewerHasBeered
          latestBeerUsers {
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
    mutation($id: ID!, $community: String!, $emotion: ArticleEmotion!) {
      undoEmotionTo#{t(thread)}(id: $id, community: $community, emotion: $emotion) {
        innerId
        emotions {
          beerCount
          viewerHasBeered
          latestBeerUsers {
            login
            nickname
          }
        }
      }
    }
    """
  end

  def m(:create_article, thread) do
    """
    mutation(
      $title: String!
      $body: String!
      $community: String!
      $articleTags: [ID]
      $linkAddr: String
    ) {
      create#{t(thread)}(
        title: $title
        body: $body
        community: $community
        articleTags: $articleTags
        linkAddr: $linkAddr
      ) {
        innerId
        title
        linkAddr
        document {
          bodyHtml
        }
        originalCommunity {
          id
        }
      }
    }
    """
  end

  def m(:mark_delete_article, thread) do
    """
    mutation($community: String!, $id: ID!){
      markDelete#{t(thread)}(community: $community, id: $id) {
        innerId
        markDelete
      }
    }
    """
  end

  def m(:undo_mark_delete_article, thread) do
    """
    mutation($community: String!, $id: ID!){
      undoMarkDelete#{t(thread)}(community: $community, id: $id) {
        innerId
        markDelete
      }
    }
    """
  end

  def m(:batch_mark_delete_article, thread) do
    """
    mutation($community: String!, $ids: [ID]!){
      batchMarkDelete#{t(thread)}s(community: $community, ids: $ids) {
        done
      }
    }
    """
  end

  def m(:batch_undo_mark_delete_article, thread) do
    """
    mutation($community: String!, $ids: [ID]!){
      batchUndoMarkDelete#{t(thread)}s(community: $community, ids: $ids) {
        done
      }
    }
    """
  end

  def m(:delete_article, thread) do
    """
    mutation($community: String!, $id: ID!){
      delete#{t(thread)}(community: $community, id: $id) {
        innerId
      }
    }
    """
  end

  def m(:update_article, thread) do
    """
    mutation($id: ID!, $community: String!, $title: String, $body: String, $copyRight: String, $articleTags: [ID]){
      update#{t(thread)}(id: $id, community: $community, title: $title, body: $body, copyRight: $copyRight, articleTags: $articleTags) {
        innerId
        title
        document {
          bodyHtml
        }
        copyRight
        meta {
          isEdited
        }
        commentsParticipants {
          id
          nickname
        }
        articleTags {
          id
        }
      }
    }
    """
  end

  def m(:upvote_article, thread) do
    """
    mutation($id: ID!, $community: String!) {
      upvote#{t(thread)}(id: $id, community: $community) {
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

  def m(:undo_upvote_article, thread) do
    """
    mutation($id: ID!, $community: String!) {
      undoUpvote#{t(thread)}(id: $id, community: $community) {
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
    mutation($id: ID!, $community: String!){
      sink#{t(thread)}(id: $id, community: $community) {
        innerId
      }
    }
    """
  end

  def m(:undo_sink_article, thread) do
    """
    mutation($id: ID!, $community: String!){
      undoSink#{t(thread)}(id: $id, community: $community) {
        innerId
      }
    }
    """
  end

  def m(:lock_comment, thread) do
    """
    mutation($id: ID!, $community: String!) {
      lock#{t(thread)}Comment(id: $id, community: $community) {
        innerId
        title
      }
    }
    """
  end

  def m(:unlock_comment, thread) do
    """
    mutation($id: ID!, $community: String!){
      undoLock#{t(thread)}Comment(id: $id, community: $community) {
        innerId
      }
    }
    """
  end

  def m(:report_article, thread) do
    """
    mutation($id: ID!, $community: String!, $reason: String!, $attr: String) {
      report#{t(thread)}(id: $id, community: $community, reason: $reason, attr: $attr) {
        innerId
        title
      }
    }
    """
  end

  def m(:undo_report_article, thread) do
    """
    mutation($id: ID!, $community: String!) {
      undoReport#{t(thread)}(id: $id, community: $community) {
        innerId
        title
      }
    }
    """
  end

  def m(:set_article_tag) do
    """
    mutation($id: ID!, $thread: Thread, $articleTagId: ID!, $community: String!) {
      setArticleTag(id: $id, thread: $thread, articleTagId: $articleTagId, community: $community) {
        id
      }
    }
    """
  end

  def m(:unset_article_tag) do
    """
    mutation($id: ID!, $thread: Thread, $articleTagId: ID!, $community: String!) {
      unsetArticleTag(id: $id, thread: $thread, articleTagId: $articleTagId, community: $community) {
        id
        title
      }
    }
    """
  end

  def m(:mirror_article) do
    """
    mutation($id: ID!, $thread: Thread, $community: String!, $targetCommunity: String!, $articleTags: [ID]) {
        mirrorArticle(id: $id, thread: $thread, community: $community, targetCommunity: $targetCommunity, articleTags: $articleTags) {
          innerId
        }
      }
    """
  end

  def m(:unmirror_article) do
    """
    mutation($id: ID!, $thread: Thread, $community: String!, $targetCommunity: String!) {
      unmirrorArticle(id: $id, thread: $thread, community: $community, targetCommunity: $targetCommunity) {
        innerId
      }
    }
    """
  end

  def m(:mirror_to_home) do
    """
    mutation($id: ID!, $community: String!, $thread: Thread, $articleTags: [ID]) {
      mirrorToHome(id: $id, community: $community, thread: $thread, articleTags: $articleTags) {
        innerId
      }
    }
    """
  end

  def m(:move_article) do
    """
    mutation($community: String!, $thread: Thread, $targetCommunity: String!, $id: ID!, $articleTags: [ID]) {
      moveArticle(id: $id, thread: $thread, community: $community, targetCommunity: $targetCommunity, articleTags: $articleTags) {
        innerId
      }
    }
    """
  end

  def m(:move_to_blackhole) do
    """
    mutation($community: String!, $thread: Thread, $id: ID!, $articleTags: [ID]) {
      moveToBlackhole(community: $community, thread: $thread, id: $id, articleTags: $articleTags) {
        innerId
      }
    }
    """
  end

  defp t(thread), do: thread |> Atom.to_string() |> String.capitalize()
end
