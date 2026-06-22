defmodule GroupherServer.Test.Helper.Schema do
  @moduledoc false

  def q(key, thread, extra \\ "")

  def q(:article, thread, extra) do
    """
    query($article: ArticleRefInput!) {
      #{thread}(article: $article) {
        title
        innerId
        communitySlug
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
            html
          }
          communities {
            id
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
    query($article: ArticleRefInput!, $filter: PagiFilter!) {
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

  def q(:collected_users) do
    """
    query($article: ArticleRefInput!, $filter: PagiFilter!) {
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

  def q(:one_comment_emotions) do
    """
    query($id: ID!) {
      oneComment(id: $id) {
        id
        emotions {
          type
          count
          viewerHasReacted
          latestUsers {
            login
          }
        }
      }
    }
    """
  end

  def q(:doc_draft) do
    """
    query($community: String!, $id: ID!) {
      docDraft(community: $community, id: $id) {
        id
        title
        slug
        digest
        insertedAt
        updatedAt
        author {
          login
          nickname
          avatar
        }
        document {
          json
          markdown
          markdownToc
          html
          xml
          rss
        }
      }
    }
    """
  end

  def q(:doc_draft_revisions) do
    """
    query($community: String!, $id: ID!, $type: ArticleRevisionType) {
      docDraftRevisions(community: $community, id: $id, type: $type) {
        id
        thread
        type
        articleId
        articleDraftId
        title
        slug
        digest
        documentJson
        contentHash
        revisionNumber
        schemaVersion
        insertedAt
        author {
          login
        }
      }
    }
    """
  end

  def m(:pin_article, thread) do
    """
    mutation($article: ArticleRefInput!){
      pin#{t(thread)}(article: $article) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:undo_pin_article, thread) do
    """
    mutation($article: ArticleRefInput!){
      undoPin#{t(thread)}(article: $article) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:emotion_article, thread) do
    """
    mutation($article: ArticleRefInput!, $emotion: ArticleEmotion!) {
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
    mutation($article: ArticleRefInput!, $emotion: ArticleEmotion!) {
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

  def m(:create_article, thread) do
    """
    mutation(
      $title: String!
      $body: String!
      $community: String!
      $communityTags: [ID]
      $linkAddr: String
    ) {
      create#{t(thread)}(
        title: $title
        body: $body
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
          id
        }
      }
    }
    """
  end

  def m(:mark_delete_article, thread) do
    """
    mutation($article: ArticleRefInput!){
      markDelete#{t(thread)}(article: $article) {
        innerId
        markDelete
      }
    }
    """
  end

  def m(:undo_mark_delete_article, thread) do
    """
    mutation($article: ArticleRefInput!){
      undoMarkDelete#{t(thread)}(article: $article) {
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
    mutation($article: ArticleRefInput!){
      delete#{t(thread)}(article: $article) {
        innerId
      }
    }
    """
  end

  def m(:update_article, thread) do
    """
    mutation($article: ArticleRefInput!, $title: String, $body: String, $copyRight: String, $communityTags: [ID]){
      update#{t(thread)}(article: $article, title: $title, body: $body, copyRight: $copyRight, communityTags: $communityTags) {
        innerId
        title
        document {
          html
        }
        copyRight
        meta {
          isEdited
        }
        commentsParticipants {
          id
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
    mutation($article: ArticleRefInput!) {
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

  def m(:undo_upvote_article, thread) do
    """
    mutation($article: ArticleRefInput!) {
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
    mutation($article: ArticleRefInput!){
      sink#{t(thread)}(article: $article) {
        innerId
      }
    }
    """
  end

  def m(:undo_sink_article, thread) do
    """
    mutation($article: ArticleRefInput!){
      undoSink#{t(thread)}(article: $article) {
        innerId
      }
    }
    """
  end

  def m(:lock_comment, thread) do
    """
    mutation($article: ArticleRefInput!) {
      lock#{t(thread)}Comment(article: $article) {
        innerId
        title
      }
    }
    """
  end

  def m(:unlock_comment, thread) do
    """
    mutation($article: ArticleRefInput!){
      undoLock#{t(thread)}Comment(article: $article) {
        innerId
      }
    }
    """
  end

  def m(:report_article, thread) do
    """
    mutation($article: ArticleRefInput!, $reason: String!, $attr: String) {
      report#{t(thread)}(article: $article, reason: $reason, attr: $attr) {
        innerId
        title
      }
    }
    """
  end

  def m(:undo_report_article, thread) do
    """
    mutation($article: ArticleRefInput!) {
      undoReport#{t(thread)}(article: $article) {
        innerId
        title
      }
    }
    """
  end

  def m(:update_doc_draft) do
    """
    mutation($community: String!, $id: ID!, $title: String, $slug: String, $body: String) {
      updateDocDraft(community: $community, id: $id, title: $title, slug: $slug, body: $body) {
        id
        title
        slug
        digest
        insertedAt
        updatedAt
        author {
          login
          nickname
          avatar
        }
        document {
          json
          markdown
          markdownToc
          html
          xml
          rss
        }
      }
    }
    """
  end

  def m(:checkpoint_doc_draft_revision) do
    """
    mutation($community: String!, $id: ID!) {
      checkpointDocDraftRevision(community: $community, id: $id) {
        id
        thread
        type
        articleDraftId
        title
        slug
        documentJson
        contentHash
        revisionNumber
        author {
          login
        }
      }
    }
    """
  end

  def m(:publish_doc_draft_revision) do
    """
    mutation($community: String!, $id: ID!) {
      publishDocDraftRevision(community: $community, id: $id) {
        id
        thread
        type
        articleId
        articleDraftId
        title
        slug
        documentJson
        contentHash
        revisionNumber
        author {
          login
        }
      }
    }
    """
  end

  def m(:restore_doc_draft_revision) do
    """
    mutation($community: String!, $id: ID!, $revisionId: ID!) {
      restoreDocDraftRevision(community: $community, id: $id, revisionId: $revisionId) {
        id
        title
        slug
        document {
          json
        }
      }
    }
    """
  end

  def m(:set_community_tag) do
    """
    mutation($article: ArticleRefInput!, $communityTagId: ID!) {
      setCommunityTag(article: $article, communityTagId: $communityTagId) {
        innerId
      }
    }
    """
  end

  def m(:unset_community_tag) do
    """
    mutation($article: ArticleRefInput!, $communityTagId: ID!) {
      unsetCommunityTag(article: $article, communityTagId: $communityTagId) {
        innerId
        title
      }
    }
    """
  end

  def m(:mirror_article) do
    """
    mutation($article: ArticleRefInput!, $targetCommunity: String!, $communityTags: [ID]) {
        mirrorArticle(article: $article, targetCommunity: $targetCommunity, communityTags: $communityTags) {
          innerId
        }
      }
    """
  end

  def m(:unmirror_article) do
    """
    mutation($article: ArticleRefInput!, $targetCommunity: String!) {
      unmirrorArticle(article: $article, targetCommunity: $targetCommunity) {
        innerId
      }
    }
    """
  end

  def m(:mirror_to_home) do
    """
    mutation($article: ArticleRefInput!, $communityTags: [ID]) {
      mirrorToHome(article: $article, communityTags: $communityTags) {
        innerId
      }
    }
    """
  end

  def m(:move_article) do
    """
    mutation($article: ArticleRefInput!, $targetCommunity: String!, $communityTags: [ID]) {
      moveArticle(article: $article, targetCommunity: $targetCommunity, communityTags: $communityTags) {
        innerId
      }
    }
    """
  end

  def m(:move_to_blackhole) do
    """
    mutation($article: ArticleRefInput!, $communityTags: [ID]) {
      moveToBlackhole(article: $article, communityTags: $communityTags) {
        innerId
      }
    }
    """
  end

  def m(:create_comment) do
    """
    mutation($community: String!, $thread: Thread!, $id: ID!, $body: String!) {
      createComment(community: $community, thread: $thread, id: $id, body: $body) {
        id
        bodyHtml
      }
    }
    """
  end

  def m(:update_comment) do
    """
    mutation($id: ID!, $body: String!) {
      updateComment(id: $id, body: $body) {
        id
        bodyHtml
      }
    }
    """
  end

  def m(:delete_comment) do
    """
    mutation($id: ID!) {
      deleteComment(id: $id) {
        id
        isDeleted
      }
    }
    """
  end

  def m(:reply_comment) do
    """
    mutation($id: ID!, $body: String!) {
      replyComment(id: $id, body: $body) {
        id
        bodyHtml
      }
    }
    """
  end

  def m(:upvote_comment) do
    """
    mutation($id: ID!) {
      upvoteComment(id: $id) {
        id
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
  end

  def m(:undo_upvote_comment) do
    """
    mutation($id: ID!) {
      undoUpvoteComment(id: $id) {
        id
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
  end

  def m(:pin_comment) do
    """
    mutation($id: ID!){
      pinComment(id: $id) {
        id
        isPinned
      }
    }
    """
  end

  def m(:undo_pin_comment) do
    """
    mutation($id: ID!){
      undoPinComment(id: $id) {
        id
        isPinned
      }
    }
    """
  end

  def m(:emotion_to_comment) do
    """
    mutation($id: ID!, $emotion: CommentEmotion!) {
      emotionToComment(id: $id, emotion: $emotion) {
        id
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

  def m(:undo_emotion_to_comment) do
    """
    mutation($id: ID!, $emotion: CommentEmotion!) {
      undoEmotionToComment(id: $id, emotion: $emotion) {
        id
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

  defp t(thread), do: thread |> Atom.to_string() |> String.capitalize()
end
