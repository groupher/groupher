defmodule GroupherServer.Test.Helper.Schema do
  @moduledoc false

  def q(key, thread, extra \\ "")

  def q(:article, thread, extra) do
    """
    query($article: ArticlePathInput!) {
      #{thread}(article: $article) {
        title
        innerId
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
          innerId
          bodyHtml
          author {
            login
          }
          article {
            innerId
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
          slug
          title
        }
        totalCount
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

  def q(:one_comment_emotions) do
    """
    query($comment: CommentPathInput!) {
      oneComment(comment: $comment) {
        innerId
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
        docId
        title
        subtitle
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

  def q(:doc_draft_snapshots) do
    """
    query($community: String!, $id: ID!, $stage: ArticleSnapshotStage) {
      docDraftSnapshots(community: $community, id: $id, stage: $stage) {
        id
        thread
        stage
        docId
        title
        slug
        subtitle
        digest
        documentJson
        contentHash
        snapshotNumber
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
          slug
        }
      }
    }
    """
  end

  def m(:mark_delete_article, thread) do
    """
    mutation($article: ArticlePathInput!){
      markDelete#{t(thread)}(article: $article) {
        innerId
        markDelete
      }
    }
    """
  end

  def m(:undo_mark_delete_article, thread) do
    """
    mutation($article: ArticlePathInput!){
      undoMarkDelete#{t(thread)}(article: $article) {
        innerId
        markDelete
      }
    }
    """
  end

  def m(:batch_mark_delete_article, thread) do
    """
    mutation($community: String!, $innerIds: [Int!]!){
      batchMarkDelete#{t(thread)}s(community: $community, innerIds: $innerIds) {
        done
      }
    }
    """
  end

  def m(:batch_undo_mark_delete_article, thread) do
    """
    mutation($community: String!, $innerIds: [Int!]!){
      batchUndoMarkDelete#{t(thread)}s(community: $community, innerIds: $innerIds) {
        done
      }
    }
    """
  end

  def m(:delete_article, thread) do
    """
    mutation($article: ArticlePathInput!){
      delete#{t(thread)}(article: $article) {
        innerId
      }
    }
    """
  end

  def m(:update_article, thread) do
    """
    mutation($article: ArticlePathInput!, $title: String, $body: String, $copyRight: String, $communityTags: [ID]){
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

  def m(:update_doc_draft) do
    """
    mutation($community: String!, $id: ID!, $title: String, $subtitle: String, $slug: String, $body: String) {
      updateDocDraft(community: $community, id: $id, title: $title, subtitle: $subtitle, slug: $slug, body: $body) {
        id
        docId
        title
        subtitle
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

  def m(:checkpoint_doc_draft_snapshot) do
    """
    mutation($community: String!, $id: ID!) {
      checkpointDocDraftSnapshot(community: $community, id: $id) {
        id
        thread
        stage
        docId
        title
        slug
        subtitle
        digest
        documentJson
        contentHash
        snapshotNumber
        author {
          login
        }
      }
    }
    """
  end

  def m(:publish_doc_changes) do
    """
    mutation($community: String!, $input: DocPublishChangesInput) {
      publishDocChanges(community: $community, input: $input) {
        done
        release {
          id
          releaseNumber
        }
        scope {
          totalCount
        }
      }
    }
    """
  end

  def m(:restore_doc_draft_snapshot) do
    """
    mutation($community: String!, $id: ID!, $snapshotId: ID!) {
      restoreDocDraftSnapshot(community: $community, id: $id, snapshotId: $snapshotId) {
        id
        title
        subtitle
        slug
        digest
        document {
          json
        }
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

  def m(:mirror_article) do
    """
    mutation($article: ArticlePathInput!, $targetCommunity: String!, $communityTags: [ID]) {
        mirrorArticle(article: $article, targetCommunity: $targetCommunity, communityTags: $communityTags) {
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

  def m(:mirror_to_home) do
    """
    mutation($article: ArticlePathInput!, $communityTags: [ID]) {
      mirrorToHome(article: $article, communityTags: $communityTags) {
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

  def m(:move_to_blackhole) do
    """
    mutation($article: ArticlePathInput!, $communityTags: [ID]) {
      moveToBlackhole(article: $article, communityTags: $communityTags) {
        innerId
      }
    }
    """
  end

  def m(:create_comment) do
    """
    mutation($article: ArticlePathInput!, $body: String!) {
      createComment(article: $article, body: $body) {
        innerId
        bodyHtml
      }
    }
    """
  end

  def m(:update_comment) do
    """
    mutation($comment: CommentPathInput!, $body: String!) {
      updateComment(comment: $comment, body: $body) {
        innerId
        bodyHtml
      }
    }
    """
  end

  def m(:delete_comment) do
    """
    mutation($comment: CommentPathInput!) {
      deleteComment(comment: $comment) {
        innerId
        isDeleted
      }
    }
    """
  end

  def m(:reply_comment) do
    """
    mutation($comment: CommentPathInput!, $body: String!) {
      replyComment(comment: $comment, body: $body) {
        innerId
        bodyHtml
      }
    }
    """
  end

  def m(:upvote_comment) do
    """
    mutation($comment: CommentPathInput!) {
      upvoteComment(comment: $comment) {
        innerId
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
  end

  def m(:undo_upvote_comment) do
    """
    mutation($comment: CommentPathInput!) {
      undoUpvoteComment(comment: $comment) {
        innerId
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
  end

  def m(:report_comment) do
    """
    mutation($comment: CommentPathInput!, $reason: String!, $attr: String) {
      reportComment(comment: $comment, reason: $reason, attr: $attr) {
        innerId
        viewerHasReported
        meta {
          reportedCount
        }
      }
    }
    """
  end

  def m(:undo_report_comment) do
    """
    mutation($comment: CommentPathInput!) {
      undoReportComment(comment: $comment) {
        innerId
        viewerHasReported
        meta {
          reportedCount
        }
      }
    }
    """
  end

  def m(:pin_comment) do
    """
    mutation($comment: CommentPathInput!){
      pinComment(comment: $comment) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:undo_pin_comment) do
    """
    mutation($comment: CommentPathInput!){
      undoPinComment(comment: $comment) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:emotion_to_comment) do
    """
    mutation($comment: CommentPathInput!, $emotion: CommentEmotion!) {
      emotionToComment(comment: $comment, emotion: $emotion) {
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

  def m(:undo_emotion_to_comment) do
    """
    mutation($comment: CommentPathInput!, $emotion: CommentEmotion!) {
      undoEmotionToComment(comment: $comment, emotion: $emotion) {
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

  defp t(thread), do: thread |> Atom.to_string() |> String.capitalize()
end
