defmodule GroupherServer.Test.Helper.Schema.Article do
  @moduledoc "GraphQL documents used by article tests."

  def m(:trash_article) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!) {
      trashArticle(article: $article, commandId: $commandId) {
        id
        thread
        articleId
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
    mutation($id: ID!, $community: String!, $thread: Thread!, $commandId: ID!) {
      restoreTrashedArticle(id: $id, community: $community, thread: $thread, commandId: $commandId) {
        innerId
        title
        ... on Post {
          commandId
        }
      }
    }
    """
  end

  def m(:permanently_delete_trashed_article) do
    """
    mutation($id: ID!, $community: String!, $thread: Thread!, $commandId: ID!) {
      permanentlyDeleteTrashedArticle(id: $id, community: $community, thread: $thread, commandId: $commandId) {
        done
        commandId
      }
    }
    """
  end

  def m(:set_post_cat) do
    """
    mutation(
          $article: ArticlePathInput!
          $cat: ArticleCatEnum!
          $commandId: ID!
        ) {
          setPostCat(
            article: $article
            cat: $cat
            commandId: $commandId
          ) {
            innerId
            cat
          }
        }
    """
  end

  def m(:move_article) do
    """
    mutation($article: ArticlePathInput!, $targetCommunity: String!, $communityTags: [ID], $commandId: ID!) {
      moveArticle(article: $article, targetCommunity: $targetCommunity, communityTags: $communityTags, commandId: $commandId) {
        innerId
      }
    }
    """
  end

  def m(:unmirror_article) do
    """
    mutation($article: ArticlePathInput!, $targetCommunity: String!, $commandId: ID!) {
      unmirrorArticle(article: $article, targetCommunity: $targetCommunity, commandId: $commandId) {
        innerId
      }
    }
    """
  end

  def m(:mirror_article) do
    """
    mutation($article: ArticlePathInput!, $targetCommunity: String!, $communityTags: [ID], $commandId: ID!) {
        mirrorArticle(article: $article, targetCommunity: $targetCommunity, communityTags: $communityTags, commandId: $commandId) {
          innerId
        }
      }
    """
  end

  def m(:set_community_tag) do
    """
    mutation($article: ArticlePathInput!, $communityTagId: ID!, $commandId: ID!) {
      setCommunityTag(article: $article, communityTagId: $communityTagId, commandId: $commandId) {
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
          $commandId: ID!
        ) {
          setPostStatus(
            article: $article
            status: $status
            commandId: $commandId
          ) {
            innerId
            status
          }
        }
    """
  end

  def m(:unset_community_tag) do
    """
    mutation($article: ArticlePathInput!, $communityTagId: ID!, $commandId: ID!) {
      unsetCommunityTag(article: $article, communityTagId: $communityTagId, commandId: $commandId) {
        innerId
        title
      }
    }
    """
  end

  def m(:undo_upvote_article, thread) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!) {
      undoUpvote#{t(thread)}(article: $article, commandId: $commandId) {
        commandId
        reactionOutcome
        interactionState {
          innerId
          viewerHasUpvoted
        }
      }
    }
    """
  end

  def m(:sink_article, thread) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!){
      sink#{t(thread)}(article: $article, commandId: $commandId) {
        innerId
      }
    }
    """
  end

  def m(:undo_sink_article, thread) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!){
      undoSink#{t(thread)}(article: $article, commandId: $commandId) {
        innerId
      }
    }
    """
  end

  def m(:lock_comment, thread) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!) {
      lock#{t(thread)}Comment(article: $article, commandId: $commandId) {
        innerId
        title
      }
    }
    """
  end

  def m(:unlock_comment, thread) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!){
      undoLock#{t(thread)}Comment(article: $article, commandId: $commandId) {
        innerId
      }
    }
    """
  end

  def m(:pin_article, thread) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!){
      pin#{t(thread)}(article: $article, commandId: $commandId) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:undo_pin_article, thread) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!){
      undoPin#{t(thread)}(article: $article, commandId: $commandId) {
        innerId
        isPinned
      }
    }
    """
  end

  def m(:emotion_article, thread) do
    """
    mutation($article: ArticlePathInput!, $emotion: ArticleEmotion!, $commandId: ID!) {
      emotionTo#{t(thread)}(article: $article, emotion: $emotion, commandId: $commandId) {
        commandId
        reactionOutcome
        interactionState {
          innerId
          viewerEmotion
        }
        articleStats {
          emotionCounts {
          type
          count
          }
        }
      }
    }
    """
  end

  def m(:undo_emotion_article, thread) do
    """
    mutation($article: ArticlePathInput!, $emotion: ArticleEmotion!, $commandId: ID!) {
      undoEmotionTo#{t(thread)}(article: $article, emotion: $emotion, commandId: $commandId) {
        commandId
        reactionOutcome
        interactionState {
          innerId
          viewerEmotion
        }
        articleStats {
          emotionCounts {
            type
            count
          }
        }
      }
    }
    """
  end

  def m(:create_article_draft, thread) do
    """
    mutation($community: String!, $title: String!, $bodyBag: ArtimentBodyBagInput!, $commandId: ID!) {
      create#{t(thread)}Draft(community: $community, title: $title, bodyBag: $bodyBag, commandId: $commandId) {
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
      $commandId: ID!
      $communityTags: [ID]
      $linkAddr: String
    ) {
      create#{t(thread)}(
        title: $title
        bodyBag: $bodyBag
        community: $community
        commandId: $commandId
        communityTags: $communityTags
        linkAddr: $linkAddr
      ) {
        innerId
        title
        linkAddr
        body {
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
    mutation($community: String!, $id: ID!, $expectedVersion: Int!, $title: String, $bodyBag: ArtimentBodyBagInput, $commandId: ID!) {
      update#{t(thread)}Draft(community: $community, id: $id, expectedVersion: $expectedVersion, title: $title, bodyBag: $bodyBag, commandId: $commandId) {
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
    mutation($community: String!, $id: ID!, $expectedVersion: Int!, $expectedLifecycleVersion: Int!, $commandId: ID!) {
      publish#{t(thread)}Draft(community: $community, id: $id, expectedVersion: $expectedVersion, expectedLifecycleVersion: $expectedLifecycleVersion, commandId: $commandId) {
        innerId
        title
      }
    }
    """
  end

  def m(:update_article, thread) do
    """
    mutation($article: ArticlePathInput!, $expectedVersion: Int!, $title: String, $bodyBag: ArtimentBodyBagInput, $copyRight: String, $communityTags: [ID], $commandId: ID!){
      update#{t(thread)}(article: $article, expectedVersion: $expectedVersion, title: $title, bodyBag: $bodyBag, copyRight: $copyRight, communityTags: $communityTags, commandId: $commandId) {
        innerId
        version
        title
        body {
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
    mutation($article: ArticlePathInput!, $commandId: ID!) {
      upvote#{t(thread)}(article: $article, commandId: $commandId) {
        commandId
        reactionOutcome
        interactionState {
          innerId
          viewerHasUpvoted
        }
        articleStats {
          views
          viewsRevision
          upvotesCount
          commentsCount
          snapshotAt
        }
      }
    }
    """
  end

  def m(:upvote_article_with_command_id, thread) do
    """
    mutation($article: ArticlePathInput!, $commandId: ID!) {
      upvote#{t(thread)}(article: $article, commandId: $commandId) {
        commandId
        reactionOutcome
        articleStats {
          views
          viewsRevision
          upvotesCount
          interactionRevision
          snapshotAt
        }
        interactionState {
          innerId
          viewerHasUpvoted
        }
      }
    }
    """
  end

  def m(:create_document, operation) do
    """
    mutation($title: String!, $bodyBag: ArtimentBodyBagInput!, $community: String!, $commandId: ID!) {
      #{operation}(title: $title, bodyBag: $bodyBag, community: $community, commandId: $commandId) {
        innerId
        version
        title
        body {
          json
          markdown
          toc { id level title }
          html
        }
      }
    }
    """
  end

  def m(:update_document, operation) do
    """
    mutation($article: ArticlePathInput!, $expectedVersion: Int!, $title: String, $bodyBag: ArtimentBodyBagInput, $commandId: ID!) {
      #{operation}(article: $article, expectedVersion: $expectedVersion, title: $title, bodyBag: $bodyBag, commandId: $commandId) {
        innerId
        title
        body {
          json
          markdown
          toc { id level title }
          html
        }
      }
    }
    """
  end

  def m(:update_draft_document, operation) do
    """
    mutation($community: String!, $id: ID!, $expectedVersion: Int!, $title: String, $bodyBag: ArtimentBodyBagInput, $commandId: ID!) {
      #{operation}(community: $community, id: $id, expectedVersion: $expectedVersion, title: $title, bodyBag: $bodyBag, commandId: $commandId) {
        id
        version
        title
        body {
          json
          markdown
          toc { id level title }
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
      $commandId: ID!
      $coverUrl: String
      $coverUrlDark: String
      $coverEditInfo: CoverEditInfoInput
    ) {
      create#{thread_name}(
        title: $title
        bodyBag: $bodyBag
        community: $community
        commandId: $commandId
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
      $commandId: ID!
      $expectedVersion: Int!
      $coverUrl: String
      $coverUrlDark: String
      $coverEditInfo: CoverEditInfoInput
    ) {
      update#{thread_name}(
        article: $article
        commandId: $commandId
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
    query($community: String!, $thread: Thread!, $pagi: PagiInput) {
      trashedArticles(community: $community, thread: $thread, pagi: $pagi) {
        entries {
          id
          thread
          articleId
          mentionedByCount
          article {
            innerId
            title
            articleStats {
              views
              viewsRevision
              upvotesCount
              commentsCount
              snapshotAt
            }
          }
          mentionedBy(pagi: {offset: {page: 1, size: 20}}) {
            pageInfo { ... on OffsetPageInfo { totalCount } }
          }
          mentions(pagi: {offset: {page: 1, size: 20}}) {
            pageInfo { ... on OffsetPageInfo { totalCount } }
          }
        }
        pageInfo { ... on OffsetPageInfo { totalCount } }
      }
    }
    """
  end

  def q(:collected_users) do
    """
    query($article: ArticlePathInput!, $pagi: PagiInput) {
      collectedUsers(article: $article, pagi: $pagi) {
        entries {
          login
          avatar
          nickname
        }
        pageInfo { hasNextPage ... on OffsetPageInfo { page size totalCount totalPages } ... on CursorPageInfo { endCursor } }
      }
    }
    """
  end

  def q(:grouped_kanban_posts) do
    boards =
      Enum.map_join([:backlog, :todo, :wip, :done, :rejected], "\n", fn board ->
        "#{board} { entries { innerId title cat status } pageInfo { __typename hasNextPage hasPreviousPage ... on OffsetPageInfo { page size totalCount totalPages } ... on CursorPageInfo { startCursor endCursor } } }"
      end)

    "query($community: String!) { groupedKanbanPosts(community: $community) { #{boards} } }"
  end

  def q(:paged_kanban_posts) do
    """
    query($community: String!, $filter: PostFilter, $pagi: PagiInput) {
      kanbanPage(community: $community, filter: $filter, pagi: $pagi) {
        entries {innerId title cat status}
        pageInfo { __typename hasNextPage hasPreviousPage ... on OffsetPageInfo { page size totalCount totalPages } ... on CursorPageInfo { startCursor endCursor } }
      }
    }
    """
  end

  def q(:upvoted_users) do
    """
    query($article: ArticlePathInput!, $pagi: PagiInput) {
      upvotedUsers(article: $article, pagi: $pagi) {
        entries {
          login
          avatar
          nickname
        }
        pageInfo { __typename hasNextPage hasPreviousPage ... on OffsetPageInfo {page size totalCount totalPages} ... on CursorPageInfo {startCursor endCursor} }
      }
    }
    """
  end

  def q(:article_logs) do
    """
    query($article: ArticlePathInput!, $pagi: PagiInput) {
      articleLogs(article: $article, pagi: $pagi) {
        entries {
          id
          action
          actor { type id nickname avatar }
          subject { type ref title innerId }
          target { type ref title innerId }
          payload
          occurredAt
        }
        pageInfo { __typename hasNextPage hasPreviousPage ... on OffsetPageInfo {page size totalCount totalPages} ... on CursorPageInfo {startCursor endCursor} }
      }
    }
    """
  end

  def q(key, thread, extra \\ "")

  def q(:paged_published_articles, thread, extra) do
    """
    query($login: String!, $filter: ArticlePageFilter, $pagi: PagiInput) {
      pagedPublished#{t(thread)}s(login: $login, filter: $filter, pagi: $pagi) {
        entries { innerId title thread author { login } #{extra} }
        pageInfo { __typename hasNextPage hasPreviousPage ... on OffsetPageInfo { page size totalCount totalPages } ... on CursorPageInfo { startCursor endCursor } }
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
        }
        commentsParticipants {
          login
          nickname
        }
        #{extra}
      }
    }
    """
  end

  def q(:paged_articles, thread, extra) do
    """
    query($filter: #{if thread in [:post, :changelog], do: t(thread) <> "Filter", else: "ArticlePageFilter"}, $pagi: PagiInput) {
      #{thread}Page(filter: $filter, pagi: $pagi) {
        entries { innerId title thread isPinned community { slug } author { login nickname avatar } communityTags { id } insertedAt activeAt #{extra} }
        pinnedEntries { innerId title thread isPinned community { slug } author { login nickname avatar } communityTags { id } insertedAt activeAt #{extra} }
        pageInfo { __typename hasNextPage hasPreviousPage ... on OffsetPageInfo { page size totalCount totalPages } ... on CursorPageInfo { startCursor endCursor } }
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
        body {
          json
          markdown
          toc { id level title }
          html
        }
      }
    }
    """
  end

  def q(:search_artiments, _thread, extra) do
    """
    query($query: SearchArtimentsQueryInput!, $pagi: PagiInput) {
      searchArtiments(query: $query, pagi: $pagi) {
        entries {
          artiment {
            ... on ArticleSearchArtiment {
              ref
              type
              title
              communityRef
              thread
              articleId
              indexedRevisionId
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
        pageInfo { __typename hasNextPage hasPreviousPage ... on OffsetPageInfo {page size totalCount totalPages} ... on CursorPageInfo {startCursor endCursor} }
      }
    }
    """
  end

  defp t(thread), do: thread |> Atom.to_string() |> String.capitalize()
end
