import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

/* eslint-disable */
import * as types from './graphql'

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  '\n  mutation QueryUpvotePost($article: ArticlePathInput!) {\n    upvotePost(article: $article) {\n      innerId\n      upvotesCount\n      ... on Post {\n        viewerHasUpvoted\n      }\n    }\n  }\n': typeof types.QueryUpvotePostDocument
  '\n  mutation QueryUndoUpvotePost($article: ArticlePathInput!) {\n    undoUpvotePost(article: $article) {\n      innerId\n      upvotesCount\n      ... on Post {\n        viewerHasUpvoted\n      }\n    }\n  }\n': typeof types.QueryUndoUpvotePostDocument
  '\n  mutation QueryUpvoteChangelog($article: ArticlePathInput!) {\n    upvoteChangelog(article: $article) {\n      innerId\n      upvotesCount\n      ... on Changelog {\n        viewerHasUpvoted\n      }\n    }\n  }\n': typeof types.QueryUpvoteChangelogDocument
  '\n  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!) {\n    undoUpvoteChangelog(article: $article) {\n      innerId\n      upvotesCount\n      ... on Changelog {\n        viewerHasUpvoted\n      }\n    }\n  }\n': typeof types.QueryUndoUpvoteChangelogDocument
  '\n  mutation QueryUpvoteDoc($article: ArticlePathInput!) {\n    upvoteDoc(article: $article) {\n      innerId\n      upvotesCount\n      ... on Doc {\n        viewerHasUpvoted\n      }\n    }\n  }\n': typeof types.QueryUpvoteDocDocument
  '\n  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!) {\n    undoUpvoteDoc(article: $article) {\n      innerId\n      upvotesCount\n      ... on Doc {\n        viewerHasUpvoted\n      }\n    }\n  }\n': typeof types.QueryUndoUpvoteDocDocument
  '\n  query ViewerArticleStates($filter: PagedPostsFilter!) {\n    pagedPosts(filter: $filter) {\n      entries {\n        innerId\n        community {\n          slug\n        }\n        meta {\n          thread\n        }\n        viewerHasViewed\n        viewerHasUpvoted\n      }\n    }\n  }\n': typeof types.ViewerArticleStatesDocument
  '\n  query ViewerChangelogStates($filter: PagedChangelogsFilter!) {\n    pagedChangelogs(filter: $filter) {\n      entries {\n        innerId\n        community {\n          slug\n        }\n        meta {\n          thread\n        }\n        viewerHasViewed\n        viewerHasUpvoted\n      }\n    }\n  }\n': typeof types.ViewerChangelogStatesDocument
  '\n  query PostViewerState($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n': typeof types.PostViewerStateDocument
  '\n  query ChangelogViewerState($article: ArticlePathInput!) {\n    changelog(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n': typeof types.ChangelogViewerStateDocument
  '\n  query DocViewerState($article: ArticlePathInput!) {\n    doc(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n': typeof types.DocViewerStateDocument
  '\n  mutation SetCommunityTag($article: ArticlePathInput!, $tagId: ID!) {\n    setCommunityTag(article: $article, communityTagId: $tagId) {\n      innerId\n      title\n    }\n  }\n': typeof types.SetCommunityTagDocument
  '\n  mutation UnsetCommunityTag($article: ArticlePathInput!, $tagId: ID!) {\n    unsetCommunityTag(article: $article, communityTagId: $tagId) {\n      innerId\n      title\n    }\n  }\n': typeof types.UnsetCommunityTagDocument
  '\n  mutation Follow($login: String!) {\n    follow(login: $login) {\n      login\n      viewerHasFollowed\n    }\n  }\n': typeof types.FollowDocument
  '\n  mutation UndoFollow($login: String!) {\n    undoFollow(login: $login) {\n      login\n      viewerHasFollowed\n    }\n  }\n': typeof types.UndoFollowDocument
  '\n  query CommunityActivityConfig($community: String!) {\n    communityActivityConfig(community: $community) {\n      resources {\n        resourceType\n        actions {\n          action\n          messageKey\n          category\n          highRisk\n        }\n      }\n      sources\n      actorTypes\n      presets {\n        key\n        questionKey\n        descriptionKey\n        coverageNoteKey\n        defaultTimeRange {\n          amount\n          unit\n        }\n      }\n    }\n  }\n': typeof types.CommunityActivityConfigDocument
  '\n  mutation ExportCommunityActivity(\n    $community: String!\n    $selection: CommunityActivitySelectionInput!\n    $format: CommunityActivityExportFormat!\n  ) {\n    exportCommunityActivity(community: $community, selection: $selection, format: $format) {\n      content\n      filename\n      mimeType\n      totalCount\n      exportedCount\n      manifest\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n': typeof types.ExportCommunityActivityDocument
  '\n  query CommunityActivityEvent($community: String!, $eventRef: ID!) {\n    communityActivityEvent(community: $community, eventRef: $eventRef) {\n      id\n      eventRef\n      operationRef\n      parentEventRef\n      operationIndex\n      recordSequence\n      messageKey\n      action\n      category\n      highRisk\n      outcome\n      denialCode\n      changedFields\n      resource {\n        type\n        ref\n        title\n        innerId\n      }\n      actor {\n        type\n        id\n        login\n        nickname\n        avatar\n      }\n      onBehalfOf {\n        type\n        id\n        login\n        nickname\n        avatar\n      }\n      subject {\n        type\n        ref\n        title\n        innerId\n      }\n      target {\n        type\n        ref\n        title\n        innerId\n      }\n      source\n      payload\n      metadata\n      occurredAt\n      recordedAt\n      parentEvent {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n      childEvents {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n    }\n  }\n': typeof types.CommunityActivityEventDocument
  '\n  query CommunityActivity(\n    $community: String!\n    $selection: CommunityActivitySelectionInput!\n    $page: Int = 1\n  ) {\n    communityActivity(community: $community, selection: $selection, page: $page) {\n      entries {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        onBehalfOf {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n      totalCount\n      totalPages\n      pageNumber\n      pageSize\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n': typeof types.CommunityActivityDocument
  '\n  query CommunityActivityStats($community: String!, $selection: CommunityActivitySelectionInput!) {\n    communityActivityStats(community: $community, selection: $selection) {\n      granularity\n      timezone\n      totalCount\n      buckets {\n        startedAt\n        endedAt\n        count\n      }\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n': typeof types.CommunityActivityStatsDocument
  '\n  fragment PageAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n': typeof types.PageAuthorFieldsFragmentDoc
  '\n  fragment PageCommonUserFields on CommonUser {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n': typeof types.PageCommonUserFieldsFragmentDoc
  '\n  fragment PageCommunityFields on Community {\n    title\n    slug\n    index\n    desc\n    logo\n    subscribersCount\n    homepage\n    articlesCount\n    views\n    pending\n    insertedAt\n    updatedAt\n  }\n': typeof types.PageCommunityFieldsFragmentDoc
  '\n  fragment PageTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n': typeof types.PageTagFieldsFragmentDoc
  '\n  fragment PagePostFields on Post {\n    innerId\n    version\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n': typeof types.PagePostFieldsFragmentDoc
  '\n  fragment PagePostDetailFields on Post {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n': typeof types.PagePostDetailFieldsFragmentDoc
  '\n  fragment PageChangelogFields on Changelog {\n    innerId\n    version\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n': typeof types.PageChangelogFieldsFragmentDoc
  '\n  fragment PageChangelogDetailFields on Changelog {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n': typeof types.PageChangelogDetailFieldsFragmentDoc
  '\n  fragment PagePostPageInfo on PagedPosts {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n': typeof types.PagePostPageInfoFragmentDoc
  '\n  fragment PageChangelogPageInfo on PagedChangelogs {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n': typeof types.PageChangelogPageInfoFragmentDoc
  '\n  fragment PageDocFields on Doc {\n    innerId\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n': typeof types.PageDocFieldsFragmentDoc
  '\n  fragment PageDocDetailFields on Doc {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n': typeof types.PageDocDetailFieldsFragmentDoc
  '\n  fragment PageDocPageInfo on PagedDocs {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n': typeof types.PageDocPageInfoFragmentDoc
  '\n  fragment PageCommunityPageInfo on PagedCommunities {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n': typeof types.PageCommunityPageInfoFragmentDoc
  '\n  query Changelog($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    changelog(article: $article) {\n      ...PageChangelogFields\n      ...PageChangelogDetailFields\n    }\n  }\n': typeof types.ChangelogDocument
  '\n  query PagedChangelogs($filter: PagedChangelogsFilter!, $userHasLogin: Boolean!) {\n    pagedChangelogs(filter: $filter) {\n      entries {\n        ...PageChangelogFields\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        digest\n        linkAddr\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PageChangelogPageInfo\n    }\n  }\n': typeof types.PagedChangelogsDocument
  '\n  query PageSubscribedCommunities($login: String, $filter: PagiFilter!) {\n    subscribedCommunities(login: $login, filter: $filter) {\n      entries {\n        ...PageCommunityFields\n        contributesDigest\n      }\n      ...PageCommunityPageInfo\n    }\n  }\n': typeof types.PageSubscribedCommunitiesDocument
  '\n  query PageCommunity($slug: String!, $userHasLogin: Boolean!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      title\n      slug\n      index\n      desc\n      logo\n      subscribersCount\n      homepage\n      articlesCount\n      views\n      pending\n      insertedAt\n      updatedAt\n      viewerHasSubscribed @include(if: $userHasLogin)\n      contributesDigest\n      moderatorsCount\n      meta {\n        postsCount\n        blogsCount\n      }\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n      dashboard {\n        baseInfo {\n          title\n          slug\n          locale\n          favicon\n          homepage\n          logo\n          desc\n          city\n          techstack\n          introduction\n        }\n        mediaReports {\n          url\n          title\n          siteName\n          favicon\n          index\n        }\n        thirdPartyAnalytics {\n          provider\n          enabled\n          measurementId\n          containerId\n          projectId\n          domain\n          siteId\n        }\n        enabledThirdPartyAnalytics {\n          provider\n          enabled\n          measurementId\n          containerId\n          projectId\n          domain\n          siteId\n        }\n        umamiWebsiteId\n        docFaq {\n          title\n          desc\n          groupedView\n          groupItems {\n            id\n            title\n            index\n            items {\n              id\n              title\n              detail\n              index\n            }\n          }\n          flatItems {\n            id\n            title\n            detail\n            index\n          }\n        }\n        wallpaper {\n          light {\n            type\n            source\n            gradient\n            pattern\n            contentShadow\n            effect\n            texture\n          }\n          dark {\n            type\n            source\n            gradient\n            pattern\n            contentShadow\n            effect\n            texture\n          }\n        }\n        headerLinks {\n          id\n          type\n          title\n          url\n          links {\n            id\n            title\n            url\n          }\n        }\n        footerLinks {\n          id\n          type\n          title\n          url\n          links {\n            id\n            title\n            url\n          }\n        }\n        footerOnelineLinks {\n          id\n          title\n          url\n        }\n        socialLinks {\n          type\n          link\n        }\n        seo {\n          seoEnable\n          ogSiteName\n          ogTitle\n          ogDescription\n          ogUrl\n          ogImage\n          twTitle\n          twDescription\n          twUrl\n          twCard\n          twSite\n          twImage\n          twImageWidth\n          twImageHeight\n        }\n        nameAlias {\n          slug\n          name\n          original\n          group\n        }\n        layout {\n          themePreset\n          themePresetBase\n          themeTokens\n          themePresets {\n            value\n            tokens\n          }\n          postLayout\n          docCoverLayout\n          docFaqLayout\n          tagLayout\n          inlineTagLayout\n          avatarLayout\n          brandLayout\n          communityLayout\n          navActiveLayout\n          topbarEnabled\n          topbarBg\n          topbarBgCustomColor\n          broadcastLayout\n          broadcastBg\n          broadcastCustomBg\n          broadcastArticleBg\n          broadcastArticleCustomBg\n          kanbanLayout\n          kanbanCardLayout\n          kanbanBoards\n          kanbanBgColors\n          changelogLayout\n          headerLayout\n          footerLayout\n          overlayDark\n          broadcastEnable\n        }\n        enable {\n          post\n          kanban\n          changelog\n          doc\n          docLastUpdate\n          docReaction\n          about\n          aboutTechstack\n          aboutLocation\n          aboutLinks\n          aboutMediaReport\n          visitorLocationMap\n        }\n      }\n    }\n  }\n': typeof types.PageCommunityDocument
  '\n  query PagePagedCommunities($filter: CommunitiesFilter!, $userHasLogin: Boolean!) {\n    pagedCommunities(filter: $filter) {\n      entries {\n        ...PageCommunityFields\n        contributesDigest\n        viewerHasSubscribed @include(if: $userHasLogin)\n      }\n      ...PageCommunityPageInfo\n    }\n  }\n': typeof types.PagePagedCommunitiesDocument
  '\n  fragment PageDocPublicTreeNodeFields on DocPublicTreeNode {\n    id\n    parentNodeId\n    docId\n    type\n    title\n    index\n    href\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n      appearance {\n        light {\n          color\n          bg\n        }\n        dark {\n          color\n          bg\n        }\n      }\n    }\n    badge\n  }\n': typeof types.PageDocPublicTreeNodeFieldsFragmentDoc
  '\n  fragment PageDocPublicTreeChildFields on DocPublicTreeNode {\n    ...PageDocPublicTreeNodeFields\n    pages {\n      ...PageDocPublicTreeNodeFields\n    }\n  }\n': typeof types.PageDocPublicTreeChildFieldsFragmentDoc
  '\n  fragment PageDocPublicTreeGroupFields on DocPublicTreeNode {\n    ...PageDocPublicTreeNodeFields\n    pages {\n      ...PageDocPublicTreeChildFields\n    }\n  }\n': typeof types.PageDocPublicTreeGroupFieldsFragmentDoc
  '\n  query PageDoc($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    doc(article: $article) {\n      ...PageDocFields\n      subtitle\n      ...PageDocDetailFields\n    }\n  }\n': typeof types.PageDocDocument
  '\n  query PageDocPublicTree($community: String!) {\n    docPublicTree(community: $community) {\n      tabs {\n        ...PageDocPublicTreeNodeFields\n        pins {\n          ...PageDocPublicTreeNodeFields\n        }\n        groups {\n          ...PageDocPublicTreeGroupFields\n        }\n      }\n    }\n  }\n': typeof types.PageDocPublicTreeDocument
  '\n  query PagePagedDocs($filter: PagedDocsFilter!, $userHasLogin: Boolean!) {\n    pagedDocs(filter: $filter) {\n      entries {\n        ...PageDocFields\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PageDocPageInfo\n    }\n  }\n': typeof types.PagePagedDocsDocument
  '\n  fragment PageCategoryPageInfo on PagedCategories {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n': typeof types.PageCategoryPageInfoFragmentDoc
  '\n  query PageCommunityTagGroups($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...PageTagFields\n      }\n    }\n  }\n': typeof types.PageCommunityTagGroupsDocument
  '\n  query CommunityTagStats($community: String!, $thread: Thread!, $slug: String!) {\n    communityTagStats(community: $community, thread: $thread, slug: $slug) {\n      contentsCount\n      todayContentsCount\n    }\n  }\n': typeof types.CommunityTagStatsDocument
  '\n  query ThemePresets {\n    themePresets {\n      value\n      tokens\n    }\n  }\n': typeof types.ThemePresetsDocument
  '\n  query PagePagedCategories($filter: PagiFilter!) {\n    pagedCategories(filter: $filter) {\n      entries {\n        id\n        title\n        slug\n        index\n      }\n      ...PageCategoryPageInfo\n    }\n  }\n': typeof types.PagePagedCategoriesDocument
  '\n  query Post($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    post(article: $article) {\n      ...PagePostFields\n      ...PagePostDetailFields\n    }\n  }\n': typeof types.PostDocument
  '\n  query PagedPosts($filter: PagedPostsFilter!, $userHasLogin: Boolean!) {\n    pagedPosts(filter: $filter) {\n      entries {\n        ...PagePostFields\n        cat\n        status\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        digest\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PagePostPageInfo\n    }\n  }\n': typeof types.PagedPostsDocument
  '\n  query PagedPublishedPosts($login: String!, $filter: PagiFilter!, $userHasLogin: Boolean!) {\n    pagedPublishedPosts(login: $login, filter: $filter) {\n      entries {\n        ...PagePostFields\n        meta {\n          thread\n        }\n        digest\n        linkAddr\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PagePostPageInfo\n    }\n  }\n': typeof types.PagedPublishedPostsDocument
  '\n  query PagesGroupedKanbanPosts($community: String!) {\n    groupedKanbanPosts(community: $community) {\n      backlog {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      todo {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      wip {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      done {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      rejected {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n    }\n  }\n': typeof types.PagesGroupedKanbanPostsDocument
  '\n  fragment UserAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n': typeof types.UserAuthorFieldsFragmentDoc
  '\n  fragment UserSocialFields on SocialMap {\n    github\n    twitter\n    company\n    blog\n  }\n': typeof types.UserSocialFieldsFragmentDoc
  '\n  fragment UserAchievementFields on Achievement {\n    reputation\n    articlesUpvotesCount\n    articlesCollectsCount\n  }\n': typeof types.UserAchievementFieldsFragmentDoc
  '\n  query Me {\n    me {\n      login\n      nickname\n      avatar\n      bio\n      passport\n    }\n  }\n': typeof types.MeDocument
  '\n  query User($login: String!, $userHasLogin: Boolean!) {\n    user(login: $login) {\n      ...UserAuthorFields\n      views\n      sex\n      location\n      social {\n        ...UserSocialFields\n      }\n      meta {\n        isMaker\n        publishedPostsCount\n        publishedBlogsCount\n      }\n      followersCount\n      followingsCount\n      viewerHasFollowed @include(if: $userHasLogin)\n      achievement {\n        ...UserAchievementFields\n      }\n      contributes {\n        records {\n          count\n          date\n        }\n        startDate\n        endDate\n        totalCount\n      }\n\n      subscribedCommunitiesCount\n\n      insertedAt\n    }\n  }\n': typeof types.UserDocument
  '\n  query SessionState {\n    sessionState {\n      isValid\n      user {\n        ...UserAuthorFields\n        geoCity\n        location\n        social {\n          ...UserSocialFields\n        }\n        passport\n        subscribedCommunitiesCount\n        achievement {\n          ...UserAchievementFields\n        }\n      }\n    }\n  }\n': typeof types.SessionStateDocument
  '\n  query AboutSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n': typeof types.AboutSimpleQueryDocument
  '\n  fragment ArticleEditorAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n': typeof types.ArticleEditorAuthorFieldsFragmentDoc
  '\n  fragment ArticleEditorCommunityFields on Community {\n    title\n    slug\n    index\n    desc\n    logo\n    subscribersCount\n    homepage\n    articlesCount\n    views\n    pending\n    insertedAt\n    updatedAt\n  }\n': typeof types.ArticleEditorCommunityFieldsFragmentDoc
  '\n  fragment ArticleEditorTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n': typeof types.ArticleEditorTagFieldsFragmentDoc
  '\n  mutation CreatePost(\n    $title: String!\n    $bodyBag: ArtimentBodyBagInput!\n    $community: String!\n    $communityTags: [ID]\n    $linkAddr: String\n    $copyRight: String\n  ) {\n    createPost(\n      title: $title\n      bodyBag: $bodyBag\n      community: $community\n      communityTags: $communityTags\n      linkAddr: $linkAddr\n      copyRight: $copyRight\n    ) {\n      innerId\n      title\n      meta {\n        thread\n      }\n    }\n  }\n': typeof types.CreatePostDocument
  '\n  mutation UpdatePostFromEditor(\n    $article: ArticlePathInput!\n    $expectedVersion: Int!\n    $title: String\n    $bodyBag: ArtimentBodyBagInput\n    $linkAddr: String\n    $copyRight: String\n    $communityTags: [ID]\n  ) {\n    updatePost(\n      article: $article\n      expectedVersion: $expectedVersion\n      title: $title\n      bodyBag: $bodyBag\n      linkAddr: $linkAddr\n      copyRight: $copyRight\n      communityTags: $communityTags\n    ) {\n      innerId\n      title\n      author {\n        ...ArticleEditorAuthorFields\n      }\n      meta {\n        thread\n        isLegal\n        illegalReason\n        illegalWords\n      }\n    }\n  }\n': typeof types.UpdatePostFromEditorDocument
  '\n  query ArticleEditorCommunity($slug: String!) {\n    community(slug: $slug) {\n      logo\n      title\n      slug\n      desc\n      subscribersCount\n    }\n  }\n': typeof types.ArticleEditorCommunityDocument
  '\n  query ArticleEditorPost($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n      version\n      title\n      linkAddr\n      copyRight\n      lifecycle {\n        state\n        archivedAt\n      }\n      author {\n        ...ArticleEditorAuthorFields\n      }\n      community {\n        ...ArticleEditorCommunityFields\n      }\n      communityTags {\n        ...ArticleEditorTagFields\n      }\n      meta {\n        thread\n        isLegal\n        illegalReason\n        illegalWords\n      }\n      document {\n        json\n      }\n    }\n  }\n': typeof types.ArticleEditorPostDocument
  '\n  fragment ArticleMenuTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n': typeof types.ArticleMenuTagFieldsFragmentDoc
  '\n  mutation UpdatePostFromMenu(\n    $article: ArticlePathInput!\n    $expectedVersion: Int!\n    $title: String\n    $communityTags: [ID]\n  ) {\n    updatePost(\n      article: $article\n      expectedVersion: $expectedVersion\n      title: $title\n      communityTags: $communityTags\n    ) {\n      innerId\n      title\n      communityTags {\n        ...ArticleMenuTagFields\n      }\n    }\n  }\n': typeof types.UpdatePostFromMenuDocument
  '\n  mutation SetPostCat($article: ArticlePathInput!, $cat: ArticleCatEnum!) {\n    setPostCat(article: $article, cat: $cat) {\n      innerId\n      cat\n    }\n  }\n': typeof types.SetPostCatDocument
  '\n  mutation SetPostStatus($article: ArticlePathInput!, $status: ArticleStatusEnum!) {\n    setPostStatus(article: $article, status: $status) {\n      innerId\n      status\n    }\n  }\n': typeof types.SetPostStatusDocument
  '\n  mutation PinPost($article: ArticlePathInput!) {\n    pinPost(article: $article) {\n      innerId\n    }\n  }\n': typeof types.PinPostDocument
  '\n  mutation UndoPinPost($article: ArticlePathInput!) {\n    undoPinPost(article: $article) {\n      innerId\n      isPinned\n    }\n  }\n': typeof types.UndoPinPostDocument
  '\n  query CommunityTagGroupsForMenu($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...ArticleMenuTagFields\n      }\n    }\n  }\n': typeof types.CommunityTagGroupsForMenuDocument
  '\n  query ChangelogSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n': typeof types.ChangelogSimpleQueryDocument
  '\n  fragment CommentAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n': typeof types.CommentAuthorFieldsFragmentDoc
  '\n  fragment CommentEmotionFields on EmotionStat {\n    type\n    count\n    viewerHasReacted\n    latestUsers {\n      login\n      nickname\n      avatar\n    }\n  }\n': typeof types.CommentEmotionFieldsFragmentDoc
  '\n  fragment CommentMetaFields on CommentMeta {\n    isLegal\n    illegalReason\n    illegalWords\n    isArticleAuthorUpvoted\n    isReplyToOthers\n  }\n': typeof types.CommentMetaFieldsFragmentDoc
  '\n  fragment CommentFields on Comment {\n    innerId\n    bodyHtml\n    author {\n      ...CommentAuthorFields\n    }\n    meta {\n      ...CommentMetaFields\n    }\n    emotions {\n      ...CommentEmotionFields\n    }\n    isPinned\n    isSolution\n    floor\n    upvotesCount\n    isArticleAuthor\n    viewerHasUpvoted\n    viewerHasReported\n    repliesCount\n    insertedAt\n    updatedAt\n  }\n': typeof types.CommentFieldsFragmentDoc
  '\n  fragment CommentReplyFields on CommentReply {\n    innerId\n    bodyHtml\n    author {\n      ...CommentAuthorFields\n    }\n    meta {\n      ...CommentMetaFields\n    }\n    emotions {\n      ...CommentEmotionFields\n    }\n    isPinned\n    isSolution\n    floor\n    upvotesCount\n    isArticleAuthor\n    viewerHasUpvoted\n    viewerHasReported\n    repliesCount\n    insertedAt\n    updatedAt\n    replyToComment {\n      ...CommentFields\n    }\n  }\n': typeof types.CommentReplyFieldsFragmentDoc
  '\n  fragment CommentPageFields on PagedComments {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n': typeof types.CommentPageFieldsFragmentDoc
  '\n  query PagedComments($article: ArticlePathInput!, $mode: CommentsMode, $filter: CommentsFilter!) {\n    pagedComments(article: $article, mode: $mode, filter: $filter) {\n      entries {\n        ...CommentFields\n        replyToComment {\n          ...CommentFields\n        }\n        replies {\n          ...CommentReplyFields\n        }\n      }\n      ...CommentPageFields\n    }\n  }\n': typeof types.PagedCommentsDocument
  '\n  query PagedCommentReplies($comment: CommentPathInput!, $filter: CommentsFilter!) {\n    pagedCommentReplies(comment: $comment, filter: $filter) {\n      entries {\n        ...CommentReplyFields\n      }\n      totalPages\n      totalCount\n      pageSize\n      pageNumber\n    }\n  }\n': typeof types.PagedCommentRepliesDocument
  '\n  mutation CreateComment($article: ArticlePathInput!, $body: String!) {\n    createComment(article: $article, body: $body) {\n      comment {\n        ...CommentFields\n      }\n      article {\n        innerId\n        commentsCount\n      }\n    }\n  }\n': typeof types.CreateCommentDocument
  '\n  mutation UpdateComment($comment: CommentPathInput!, $body: String!) {\n    updateComment(comment: $comment, body: $body) {\n      innerId\n      bodyHtml\n      replyToComment {\n        innerId\n      }\n    }\n  }\n': typeof types.UpdateCommentDocument
  '\n  query CommentsState($article: ArticlePathInput!, $freshkey: String) {\n    commentsState(article: $article, freshkey: $freshkey) {\n      totalCount\n      isViewerJoined\n      participantsCount\n      participants {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n': typeof types.CommentsStateDocument
  '\n  query OneComment($comment: CommentPathInput!) {\n    oneComment(comment: $comment) {\n      innerId\n      body\n    }\n  }\n': typeof types.OneCommentDocument
  '\n  mutation ReplyComment($comment: CommentPathInput!, $body: String!) {\n    replyComment(comment: $comment, body: $body) {\n      comment {\n        ...CommentFields\n        replyToComment {\n          ...CommentFields\n        }\n      }\n      article {\n        innerId\n        commentsCount\n      }\n    }\n  }\n': typeof types.ReplyCommentDocument
  '\n  mutation DeleteComment($comment: CommentPathInput!) {\n    deleteComment(comment: $comment) {\n      innerId\n    }\n  }\n': typeof types.DeleteCommentDocument
  '\n  mutation UpvoteComment($comment: CommentPathInput!) {\n    upvoteComment(comment: $comment) {\n      innerId\n      meta {\n        isArticleAuthorUpvoted\n      }\n      upvotesCount\n      viewerHasUpvoted\n      replyToComment {\n        innerId\n      }\n    }\n  }\n': typeof types.UpvoteCommentDocument
  '\n  mutation UndoUpvoteComment($comment: CommentPathInput!) {\n    undoUpvoteComment(comment: $comment) {\n      innerId\n      meta {\n        isArticleAuthorUpvoted\n      }\n      upvotesCount\n      viewerHasUpvoted\n      replyToComment {\n        innerId\n      }\n    }\n  }\n': typeof types.UndoUpvoteCommentDocument
  '\n  mutation ReportComment($comment: CommentPathInput!, $reason: String!, $attr: String) {\n    reportComment(comment: $comment, reason: $reason, attr: $attr) {\n      innerId\n      viewerHasReported\n      meta {\n        reportedCount\n      }\n    }\n  }\n': typeof types.ReportCommentDocument
  '\n  mutation UndoReportComment($comment: CommentPathInput!) {\n    undoReportComment(comment: $comment) {\n      innerId\n      viewerHasReported\n      meta {\n        reportedCount\n      }\n    }\n  }\n': typeof types.UndoReportCommentDocument
  '\n  mutation EmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {\n    emotionToComment(comment: $comment, emotion: $emotion) {\n      innerId\n      replyToComment {\n        innerId\n      }\n      emotions {\n        ...CommentEmotionFields\n      }\n    }\n  }\n': typeof types.EmotionToCommentDocument
  '\n  mutation UndoEmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {\n    undoEmotionToComment(comment: $comment, emotion: $emotion) {\n      innerId\n      replyToComment {\n        innerId\n      }\n      emotions {\n        ...CommentEmotionFields\n      }\n    }\n  }\n': typeof types.UndoEmotionToCommentDocument
  '\n  query SearchUsers($name: String!) {\n    searchUsers(name: $name) {\n      entries {\n        ...CommentAuthorFields\n      }\n    }\n  }\n': typeof types.SearchUsersDocument
  '\n  query PagedPublishedComments($login: String!, $thread: Thread, $filter: PagiFilter!) {\n    pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {\n      entries {\n        ...CommentFields\n        article {\n          innerId\n          title\n          thread\n          author {\n            nickname\n            login\n          }\n        }\n      }\n      ...CommentPageFields\n    }\n  }\n': typeof types.PagedPublishedCommentsDocument
  '\n  query CoverSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n': typeof types.CoverSimpleQueryDocument
  '\n  fragment DocCoverMarkerFields on Marker {\n    type\n    provider\n    name\n    src\n    unified\n    appearance {\n      light {\n        color\n        bg\n      }\n      dark {\n        color\n        bg\n      }\n    }\n  }\n': typeof types.DocCoverMarkerFieldsFragmentDoc
  '\n  fragment DocCoverItemFields on DocCoverCardItem {\n    id\n    nodeId\n    docId\n    index\n    type\n    title\n    href\n    badge\n    leafCount\n    marker {\n      ...DocCoverMarkerFields\n    }\n  }\n': typeof types.DocCoverItemFieldsFragmentDoc
  '\n  query DocCover($community: String!, $view: DocCoverView = PUBLIC) {\n    docCover(community: $community, view: $view) {\n      cards {\n        id\n        groupNodeId\n        index\n        appearance\n        title\n        items {\n          ...DocCoverItemFields\n        }\n      }\n      pinnedDocs {\n        nodeId\n        index\n        appearance\n        href\n        doc {\n          title\n          author {\n            avatar\n            nickname\n          }\n          document {\n            thumbnail\n          }\n        }\n      }\n    }\n  }\n': typeof types.DocCoverDocument
  '\n  query AnalysisActiveVisitors($community: String!) {\n    analysisActiveVisitors(community: $community) {\n      visitors\n    }\n  }\n': typeof types.AnalysisActiveVisitorsDocument
  '\n  query AnalysisTrendPages(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendPagesDimension!\n  ) {\n    analysisTrendPages(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n          bounceRate\n          visitDuration\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n': typeof types.AnalysisTrendPagesDocument
  '\n  query AnalysisTrendSources(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendSourcesDimension!\n  ) {\n    analysisTrendSources(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n': typeof types.AnalysisTrendSourcesDocument
  '\n  query AnalysisTrendEnvironment(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendEnvironmentDimension!\n  ) {\n    analysisTrendEnvironment(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n          percentage\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n': typeof types.AnalysisTrendEnvironmentDocument
  '\n  query AnalysisTrendLocation(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendLocationDimension!\n  ) {\n    analysisTrendLocation(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        code\n        metrics {\n          visitors\n          visits\n          views\n          percentage\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n': typeof types.AnalysisTrendLocationDocument
  '\n  query AnalysisTrendTraffic($community: String!, $days: Int) {\n    analysisTrendTraffic(community: $community, days: $days) {\n      status\n      timezone\n      cells {\n        weekday\n        hour\n        visitors\n        visits\n        views\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n': typeof types.AnalysisTrendTrafficDocument
  '\n  query AnalysisTrendsOverview($community: String!, $days: Int) {\n    analysisTrendsOverview(community: $community, days: $days) {\n      status\n      provider\n      range {\n        days\n        startAt\n        endAt\n        bucket\n      }\n      summary {\n        pageviews {\n          value\n          previousValue\n          changeRate\n        }\n        visitors {\n          value\n          previousValue\n          changeRate\n        }\n        visits {\n          value\n          previousValue\n          changeRate\n        }\n        bounceRate {\n          value\n          previousValue\n          changeRate\n        }\n        visitDuration {\n          value\n          previousValue\n          changeRate\n        }\n      }\n      chart {\n        bucket\n        points {\n          timestamp\n          visits\n          views\n        }\n      }\n      errors {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n': typeof types.AnalysisTrendsOverviewDocument
  '\n  mutation SaveCustomThemePreset(\n    $community: String!\n    $themePreset: DsbThemePreset!\n    $themePresetBase: DsbThemePreset!\n    $themeOverwrite: Json\n  ) {\n    saveCustomThemePreset(\n      community: $community\n      themePreset: $themePreset\n      themePresetBase: $themePresetBase\n      themeOverwrite: $themeOverwrite\n    ) {\n      layout {\n        themePreset\n        themePresetBase\n        themeTokens\n        themePresets {\n          value\n          tokens\n        }\n      }\n    }\n  }\n': typeof types.SaveCustomThemePresetDocument
  '\n  mutation SelectThemePreset($community: String!, $themePreset: DsbThemePreset!) {\n    selectThemePreset(community: $community, themePreset: $themePreset) {\n      layout {\n        themePreset\n        themePresetBase\n        themeTokens\n        themePresets {\n          value\n          tokens\n        }\n      }\n    }\n  }\n': typeof types.SelectThemePresetDocument
  '\n  fragment DashboardWallpaperFields on DsbWallpaper {\n    light {\n      type\n      source\n      gradient\n      pattern\n      contentShadow\n      effect\n      texture\n    }\n    dark {\n      type\n      source\n      gradient\n      pattern\n      contentShadow\n      effect\n      texture\n    }\n  }\n': typeof types.DashboardWallpaperFieldsFragmentDoc
  '\n  mutation UpdateDashboardWallpaper($community: String!, $wallpaper: DsbWallpaperInput!) {\n    updateDashboardWallpaper(community: $community, wallpaper: $wallpaper) {\n      wallpaper {\n        ...DashboardWallpaperFields\n      }\n    }\n  }\n': typeof types.UpdateDashboardWallpaperDocument
  '\n  fragment ContentImportJobFields on ContentImportJob {\n    id\n    status\n    progress\n    process {\n      state\n      stage\n      progress {\n        completed\n        total\n        unit\n      }\n      recentBatch {\n        ref\n        label\n        state\n      }\n      updatedAt\n    }\n    errorCode\n    errorMessage\n    failedItems\n    skipped\n    targetBranch\n    firstImportedDocRef\n    sourceInfo {\n      repo\n      repoUrl\n      branch\n      commit\n      framework\n      contentRoot\n      configPaths\n    }\n    counts {\n      tabs\n      groups\n      pages\n      links\n      assets\n    }\n    tree\n    badSmells\n  }\n': typeof types.ContentImportJobFieldsFragmentDoc
  '\n  query ContentImportJob($community: String!, $jobRef: ID!) {\n    contentImportJob(community: $community, jobRef: $jobRef) {\n      ...ContentImportJobFields\n    }\n  }\n': typeof types.ContentImportJobDocument
  '\n  query DashboardCommunityModerators($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n': typeof types.DashboardCommunityModeratorsDocument
  '\n  query DashboardUserPassport($login: String!) {\n    user(login: $login) {\n      passportString\n    }\n  }\n': typeof types.DashboardUserPassportDocument
  '\n  query DashboardSearchUsers($name: String!) {\n    searchUsers(name: $name) {\n      entries {\n        login\n        avatar\n        nickname\n        bio\n        social {\n          github\n          twitter\n          zhihu\n        }\n      }\n    }\n  }\n': typeof types.DashboardSearchUsersDocument
  '\n  mutation DashboardAddModerator($community: String!, $user: String!) {\n    addModerator(community: $community, user: $user) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n': typeof types.DashboardAddModeratorDocument
  '\n  mutation DashboardAddModerators($community: String!, $users: [String!]!) {\n    addModerators(community: $community, users: $users) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n': typeof types.DashboardAddModeratorsDocument
  '\n  mutation UpdateDashboardLayout(\n    $community: String!\n    $postLayout: DsbPostLayout\n    $kanbanLayout: DsbKanbanLayout\n    $kanbanCardLayout: DsbKanbanCardLayout\n    $kanbanBoards: [KanbanBoard]\n    $footerLayout: DsbFooterLayout\n    $headerLayout: DsbHeaderLayout\n    $topbarEnabled: Boolean\n    $topbarBg: RainbowColor\n    $topbarBgCustomColor: String\n    $tagLayout: DsbTagLayout\n    $inlineTagLayout: DsbInlineTagLayout\n    $avatarLayout: DsbAvatarLayout\n    $navActiveLayout: DsbNavActiveLayout\n    $broadcastEnable: Boolean\n    $kanbanBgColors: [RainbowColor]\n    $broadcastLayout: DsbBroadcastLayout\n    $broadcastBg: RainbowColor\n    $broadcastCustomBg: String\n    $broadcastArticleLayout: DsbBroadcastArticleLayout\n    $broadcastArticleBg: RainbowColor\n    $broadcastArticleCustomBg: String\n    $broadcastArticleEnable: Boolean\n    $overlayDark: Boolean\n    $brandLayout: DsbBrandLayout\n    $communityLayout: DsbCommunityLayout\n    $changelogLayout: DsbChangelogLayout\n    $docCoverLayout: DsbDocCoverLayout\n    $docFaqLayout: DsbDocFaqLayout\n  ) {\n    updateDashboardLayout(\n      community: $community\n      postLayout: $postLayout\n      kanbanLayout: $kanbanLayout\n      kanbanCardLayout: $kanbanCardLayout\n      kanbanBoards: $kanbanBoards\n      footerLayout: $footerLayout\n      headerLayout: $headerLayout\n      topbarEnabled: $topbarEnabled\n      topbarBg: $topbarBg\n      topbarBgCustomColor: $topbarBgCustomColor\n      tagLayout: $tagLayout\n      inlineTagLayout: $inlineTagLayout\n      avatarLayout: $avatarLayout\n      navActiveLayout: $navActiveLayout\n      broadcastEnable: $broadcastEnable\n      broadcastLayout: $broadcastLayout\n      broadcastBg: $broadcastBg\n      broadcastCustomBg: $broadcastCustomBg\n      broadcastArticleLayout: $broadcastArticleLayout\n      broadcastArticleBg: $broadcastArticleBg\n      broadcastArticleCustomBg: $broadcastArticleCustomBg\n      broadcastArticleEnable: $broadcastArticleEnable\n      kanbanBgColors: $kanbanBgColors\n      overlayDark: $overlayDark\n      brandLayout: $brandLayout\n      communityLayout: $communityLayout\n      changelogLayout: $changelogLayout\n      docCoverLayout: $docCoverLayout\n      docFaqLayout: $docFaqLayout\n    ) {\n      layout {\n        postLayout\n        kanbanLayout\n        kanbanCardLayout\n        kanbanBoards\n        kanbanBgColors\n        docCoverLayout\n        docFaqLayout\n        tagLayout\n        inlineTagLayout\n        avatarLayout\n        brandLayout\n        communityLayout\n        navActiveLayout\n        topbarEnabled\n        topbarBg\n        topbarBgCustomColor\n        broadcastLayout\n        broadcastBg\n        broadcastCustomBg\n        broadcastEnable\n        broadcastArticleLayout\n        broadcastArticleBg\n        broadcastArticleCustomBg\n        broadcastArticleEnable\n        changelogLayout\n        footerLayout\n        headerLayout\n        overlayDark\n      }\n    }\n  }\n': typeof types.UpdateDashboardLayoutDocument
  '\n  mutation CreateCommunityAssetUploadIntent(\n    $community: String!\n    $file: CommunityAssetUploadFileInput!\n  ) {\n    createCommunityAssetUploadIntent(community: $community, file: $file) {\n      uploadRef\n      assetPublicRef\n      objectKey\n      capability\n      expiresAt\n      maxSizeBytes\n      allowedMimeTypes\n    }\n  }\n': typeof types.CreateCommunityAssetUploadIntentDocument
  '\n  query PagedCommunityAssets($community: String!, $filter: CommunityAssetFilter) {\n    pagedCommunityAssets(community: $community, filter: $filter) {\n      entries {\n        id\n        publicRef\n        thread\n        assetType\n        status\n        filename\n        mimeType\n        sizeBytes\n        storage\n        storageKey\n        contentHash\n        width\n        height\n        url\n        uploader {\n          login\n          nickname\n        }\n        deletedAt\n        insertedAt\n      }\n      pageNumber\n      pageSize\n      totalCount\n      totalPages\n    }\n  }\n': typeof types.PagedCommunityAssetsDocument
  '\n  query CommunityAssetStats($community: String!, $filter: CommunityAssetFilter) {\n    communityAssetStats(community: $community, filter: $filter) {\n      totalCount\n      storageBytes\n      storageLimitBytes\n      byThread {\n        thread\n        count\n      }\n      byAssetType {\n        assetType\n        count\n        subtypes {\n          key\n          label\n          count\n        }\n      }\n    }\n  }\n': typeof types.CommunityAssetStatsDocument
  '\n  query CommunityAssetRefs($community: String!, $assetId: ID!, $filter: PagiFilter) {\n    communityAssetRefs(community: $community, assetId: $assetId, filter: $filter) {\n      entries {\n        id\n        thread\n        articleId\n        usage\n        blockId\n        blockType\n        position\n        title\n        alt\n        source\n        insertedAt\n      }\n      pageNumber\n      pageSize\n      totalCount\n      totalPages\n    }\n  }\n': typeof types.CommunityAssetRefsDocument
  '\n  mutation DeleteCommunityAsset($community: String!, $id: ID!) {\n    deleteCommunityAsset(community: $community, id: $id) {\n      id\n      publicRef\n      status\n      deletedAt\n    }\n  }\n': typeof types.DeleteCommunityAssetDocument
  '\n  query DashboardTrashedPosts($community: String!, $page: Int!, $size: Int!) {\n    trashedArticles(community: $community, thread: POST, filter: { page: $page, size: $size }) {\n      entries {\n        id\n        thread\n        articleRef\n        deletedAt\n        scheduledPermanentDeletionAt\n        mentionedByCount\n        deletedBy {\n          ...DashboardAuthorFields\n        }\n        article {\n          innerId\n          title\n          views\n          upvotesCount\n          meta {\n            thread\n          }\n          ... on Post {\n            cat\n            status\n            commentsCount\n            insertedAt\n            activeAt\n            author {\n              ...DashboardAuthorFields\n            }\n            communityTags {\n              ...DashboardTagFields\n            }\n          }\n        }\n      }\n      ...DashboardTrashedArticlesPageInfo\n    }\n  }\n': typeof types.DashboardTrashedPostsDocument
  '\n  mutation restoreTrashedPost($community: String!, $id: ID!) {\n    restoreTrashedArticle(community: $community, id: $id, thread: POST) {\n      innerId\n      title\n    }\n  }\n': typeof types.RestoreTrashedPostDocument
  '\n  mutation permanentlyDeleteTrashedPost($community: String!, $id: ID!) {\n    permanentlyDeleteTrashedArticle(community: $community, id: $id, thread: POST) {\n      done\n    }\n  }\n': typeof types.PermanentlyDeleteTrashedPostDocument
  '\n  fragment DashboardDocTreeNodeFields on DocTreeNode {\n    id\n    parentNodeId\n    docId\n    type\n    title\n    index\n    href\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n      appearance {\n        light {\n          color\n          bg\n        }\n        dark {\n          color\n          bg\n        }\n      }\n    }\n    badge\n    hidden\n    publishState {\n      status\n      published\n      publishedBefore\n      hasDraft\n      publicNodeId\n      publicDocId\n      hasUnpublishedChanges\n      lastPublishedAt\n      inCover\n      hiddenFromCover\n      pinnedToCover\n    }\n  }\n': typeof types.DashboardDocTreeNodeFieldsFragmentDoc
  '\n  fragment DashboardDocTreeChildFields on DocTreeNode {\n    ...DashboardDocTreeNodeFields\n    pages {\n      ...DashboardDocTreeNodeFields\n    }\n  }\n': typeof types.DashboardDocTreeChildFieldsFragmentDoc
  '\n  fragment DashboardDocTreeGroupFields on DocTreeNode {\n    ...DashboardDocTreeNodeFields\n    pages {\n      ...DashboardDocTreeChildFields\n    }\n  }\n': typeof types.DashboardDocTreeGroupFieldsFragmentDoc
  '\n  fragment DashboardDocPublishChecklistItemFields on DocPublishChecklistItem {\n    id\n    title\n    action\n    selectedByDefault\n    selectable\n    disabledReason\n  }\n': typeof types.DashboardDocPublishChecklistItemFieldsFragmentDoc
  '\n  fragment DashboardDocTreeMutationPayload on DocTreeMutationPayload {\n    revision\n    treeState {\n      hasUnpublishedChanges\n      stagedEventCount\n      baseSnapshotId\n      latestSnapshotId\n      latestReleaseId\n      latestReleaseNumber\n      revision\n    }\n    conflict\n    node {\n      ...DashboardDocTreeNodeFields\n    }\n    affectedNodes {\n      ...DashboardDocTreeNodeFields\n    }\n  }\n': typeof types.DashboardDocTreeMutationPayloadFragmentDoc
  '\n  query DashboardDocTree($community: String!) {\n    docTree(community: $community) {\n      revision\n      treeState {\n        hasUnpublishedChanges\n        stagedEventCount\n        baseSnapshotId\n        latestSnapshotId\n        latestReleaseId\n        latestReleaseNumber\n        revision\n      }\n      stagedEvents {\n        id\n        seq\n        eventType\n        payload\n        inversePayload\n        status\n        insertedAt\n      }\n      tabs {\n        ...DashboardDocTreeNodeFields\n        pins {\n          ...DashboardDocTreeNodeFields\n        }\n        groups {\n          ...DashboardDocTreeGroupFields\n        }\n      }\n    }\n  }\n': typeof types.DashboardDocTreeDocument
  '\n  query DashboardDocPublishChecklist($community: String!) {\n    docPublishChecklist(community: $community) {\n      totalCount\n      docChanges {\n        ...DashboardDocPublishChecklistItemFields\n      }\n      treeChanges {\n        ...DashboardDocPublishChecklistItemFields\n      }\n    }\n  }\n': typeof types.DashboardDocPublishChecklistDocument
  '\n  query docTreeTrashItems($community: String!) {\n    docTreeTrashItems(community: $community) {\n      id\n      nodeId\n      docId\n      type\n      title\n      deletedFromParentNodeId\n      deletedFromIndex\n      deletedAt\n      restoredAt\n    }\n  }\n': typeof types.DocTreeTrashItemsDocument
  '\n  query docDraft($community: String!, $id: ID!) {\n    docDraft(community: $community, id: $id) {\n      id\n      docId\n      title\n      subtitle\n      slug\n      stage\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n': typeof types.DocDraftDocument
  '\n  query docDraftSnapshots($community: String!, $id: ID!, $stage: DocSnapshotStage) {\n    docDraftSnapshots(community: $community, id: $id, stage: $stage) {\n      id\n      thread\n      stage\n      action\n      articleHashId\n      title\n      slug\n      subtitle\n      digest\n      documentJson\n      versionHash\n      revisionNumber\n      schemaVersion\n      insertedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n': typeof types.DocDraftSnapshotsDocument
  '\n  mutation CreateDocTreeNode(\n    $community: String!\n    $baseRevision: Int!\n    $parentNodeId: ID\n    $input: DocTreeNodeInput!\n  ) {\n    createDocTreeNode(\n      community: $community\n      baseRevision: $baseRevision\n      parentNodeId: $parentNodeId\n      input: $input\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n': typeof types.CreateDocTreeNodeDocument
  '\n  mutation UpdateDocTreeNode(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $patch: DocTreeNodePatchInput!\n  ) {\n    updateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision, patch: $patch) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n': typeof types.UpdateDocTreeNodeDocument
  '\n  mutation UpdateDocDraft(\n    $community: String!\n    $id: ID!\n    $expectedVersion: Int!\n    $title: String\n    $subtitle: String\n    $slug: String\n    $bodyBag: ArtimentBodyBagInput\n  ) {\n    updateDocDraft(\n      community: $community\n      id: $id\n      expectedVersion: $expectedVersion\n      title: $title\n      subtitle: $subtitle\n      slug: $slug\n      bodyBag: $bodyBag\n    ) {\n      id\n      docId\n      title\n      subtitle\n      slug\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n': typeof types.UpdateDocDraftDocument
  '\n  mutation checkpointDocDraftSnapshot($community: String!, $id: ID!) {\n    checkpointDocDraftSnapshot(community: $community, id: $id) {\n      id\n      thread\n      stage\n      action\n      articleHashId\n      title\n      slug\n      subtitle\n      documentJson\n      digest\n      versionHash\n      revisionNumber\n      schemaVersion\n      insertedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n': typeof types.CheckpointDocDraftSnapshotDocument
  '\n  mutation publishDocChanges(\n    $community: String!\n    $input: DocPublishChangesInput\n    $mode: DocPublishMode\n  ) {\n    publishDocChanges(community: $community, input: $input, mode: $mode) {\n      done\n      release {\n        id\n        releaseNumber\n        publishedAt\n      }\n      checklist {\n        totalCount\n        docChanges {\n          ...DashboardDocPublishChecklistItemFields\n        }\n        treeChanges {\n          ...DashboardDocPublishChecklistItemFields\n        }\n      }\n    }\n  }\n': typeof types.PublishDocChangesDocument
  '\n  mutation moveDocToDraft($community: String!, $id: ID!) {\n    moveDocToDraft(community: $community, id: $id) {\n      docId\n      stage\n      publishState {\n        status\n        published\n        publishedBefore\n        hasDraft\n        publicNodeId\n        publicDocId\n        hasUnpublishedChanges\n        lastPublishedAt\n        inCover\n        hiddenFromCover\n        pinnedToCover\n      }\n    }\n  }\n': typeof types.MoveDocToDraftDocument
  '\n  mutation moveDocTreeSubtreeToDraft($community: String!, $nodeId: ID!) {\n    moveDocTreeSubtreeToDraft(community: $community, nodeId: $nodeId) {\n      done\n    }\n  }\n': typeof types.MoveDocTreeSubtreeToDraftDocument
  '\n  mutation restoreDocDraftSnapshot($community: String!, $id: ID!, $snapshotId: ID!) {\n    restoreDocDraftSnapshot(community: $community, id: $id, snapshotId: $snapshotId) {\n      id\n      title\n      subtitle\n      slug\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n': typeof types.RestoreDocDraftSnapshotDocument
  '\n  mutation DeleteDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {\n    deleteDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n': typeof types.DeleteDocTreeNodeDocument
  '\n  mutation RestoreDocTreeTrashItem(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $targetParentNodeId: ID\n    $targetIndex: Int\n  ) {\n    restoreDocTreeTrashItem(\n      community: $community\n      id: $id\n      baseRevision: $baseRevision\n      targetParentNodeId: $targetParentNodeId\n      targetIndex: $targetIndex\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n': typeof types.RestoreDocTreeTrashItemDocument
  '\n  mutation DuplicateDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {\n    duplicateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n': typeof types.DuplicateDocTreeNodeDocument
  '\n  mutation MoveDocTreeNode(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $targetParentNodeId: ID\n    $targetIndex: Int\n  ) {\n    moveDocTreeNode(\n      community: $community\n      id: $id\n      baseRevision: $baseRevision\n      targetParentNodeId: $targetParentNodeId\n      targetIndex: $targetIndex\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n': typeof types.MoveDocTreeNodeDocument
  '\n  mutation addDocCoverCard($community: String!, $groupNodeId: ID!) {\n    addDocCoverCard(community: $community, groupNodeId: $groupNodeId) {\n      id\n      index\n      appearance\n    }\n  }\n': typeof types.AddDocCoverCardDocument
  '\n  mutation removeDocCoverCard($community: String!, $groupNodeId: ID!) {\n    removeDocCoverCard(community: $community, groupNodeId: $groupNodeId) {\n      id\n      index\n      appearance\n    }\n  }\n': typeof types.RemoveDocCoverCardDocument
  '\n  mutation reorderDocCoverCards($community: String!, $ids: [ID!]!) {\n    reorderDocCoverCards(community: $community, ids: $ids) {\n      done\n    }\n  }\n': typeof types.ReorderDocCoverCardsDocument
  '\n  mutation pinDocToCover($community: String!, $nodeId: ID!) {\n    pinDocToCover(community: $community, nodeId: $nodeId) {\n      nodeId\n      index\n      appearance\n    }\n  }\n': typeof types.PinDocToCoverDocument
  '\n  mutation unpinDocFromCover($community: String!, $nodeId: ID!) {\n    unpinDocFromCover(community: $community, nodeId: $nodeId) {\n      nodeId\n    }\n  }\n': typeof types.UnpinDocFromCoverDocument
  '\n  mutation reorderDocCoverPinnedDocs($community: String!, $nodeIds: [ID!]!) {\n    reorderDocCoverPinnedDocs(community: $community, nodeIds: $nodeIds) {\n      done\n    }\n  }\n': typeof types.ReorderDocCoverPinnedDocsDocument
  '\n  mutation updateDocCoverCardAppearance($community: String!, $id: ID!, $appearance: Json!) {\n    updateDocCoverCardAppearance(community: $community, id: $id, appearance: $appearance) {\n      id\n      appearance\n    }\n  }\n': typeof types.UpdateDocCoverCardAppearanceDocument
  '\n  mutation updatePinnedDocAppearance($community: String!, $nodeId: ID!, $appearance: Json!) {\n    updatePinnedDocAppearance(community: $community, nodeId: $nodeId, appearance: $appearance) {\n      nodeId\n      appearance\n    }\n  }\n': typeof types.UpdatePinnedDocAppearanceDocument
  '\n  fragment DashboardAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n': typeof types.DashboardAuthorFieldsFragmentDoc
  '\n  fragment DashboardTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n': typeof types.DashboardTagFieldsFragmentDoc
  '\n  fragment DashboardThirdPartyAnalyticsFields on DsbThirdPartyAnalytics {\n    provider\n    enabled\n    measurementId\n    containerId\n    projectId\n    domain\n    siteId\n  }\n': typeof types.DashboardThirdPartyAnalyticsFieldsFragmentDoc
  '\n  fragment DashboardHeaderLinkFields on DsbLink {\n    id\n    type\n    title\n    url\n    links {\n      id\n      title\n      url\n    }\n  }\n': typeof types.DashboardHeaderLinkFieldsFragmentDoc
  '\n  fragment DashboardFooterOnelineLinkFields on DsbLinkChild {\n    id\n    title\n    url\n  }\n': typeof types.DashboardFooterOnelineLinkFieldsFragmentDoc
  '\n  fragment DashboardTrashedArticlesPageInfo on PagedTrashedArticles {\n    totalCount\n    pageSize\n    totalPages\n    pageNumber\n  }\n': typeof types.DashboardTrashedArticlesPageInfoFragmentDoc
  '\n  query DashboardPressConfig($community: String!) {\n    pressConfig(community: $community) {\n      markdownEnabled\n      feedEnabled\n      feedType\n      feedCount\n      feedThreads\n      llmsEnabled\n      sitemapEnabled\n      revision\n    }\n  }\n': typeof types.DashboardPressConfigDocument
  '\n  mutation UpdateDashboardPressConfig($input: UpdatePressConfigInput!) {\n    updatePressConfig(input: $input) {\n      config {\n        markdownEnabled\n        feedEnabled\n        feedType\n        feedCount\n        feedThreads\n        llmsEnabled\n        sitemapEnabled\n        revision\n      }\n    }\n  }\n': typeof types.UpdateDashboardPressConfigDocument
  '\n  query DashboardThirdPartyAnalyticsProviders {\n    thirdPartyAnalyticsProviders {\n      provider\n      title\n      desc\n      detail\n      docsUrl\n      icon\n      identityField\n      configFields {\n        key\n        label\n        desc\n        placeholder\n        requiredWhenEnabled\n        pattern\n      }\n    }\n  }\n': typeof types.DashboardThirdPartyAnalyticsProvidersDocument
  '\n  query DashboardOpenGraphInfo($url: String!) {\n    openGraphInfo(url: $url) {\n      title\n      favicon\n      url\n      siteName\n    }\n  }\n': typeof types.DashboardOpenGraphInfoDocument
  '\n  mutation UpdateDashboardBaseInfo(\n    $community: String!\n    $homepage: String\n    $title: String\n    $slug: String\n    $desc: String\n    $locale: String\n    $introduction: String\n    $logo: String\n    $favicon: String\n    $city: String\n    $techstack: String\n  ) {\n    updateDashboardBaseInfo(\n      community: $community\n      homepage: $homepage\n      title: $title\n      slug: $slug\n      desc: $desc\n      locale: $locale\n      introduction: $introduction\n      logo: $logo\n      favicon: $favicon\n      city: $city\n      techstack: $techstack\n    ) {\n      baseInfo {\n        title\n        logo\n        favicon\n        locale\n      }\n    }\n  }\n': typeof types.UpdateDashboardBaseInfoDocument
  '\n  mutation UpdateDashboardMediaReports($community: String!, $mediaReports: [DsbMediaReportMap]) {\n    updateDashboardMediaReports(community: $community, mediaReports: $mediaReports) {\n      mediaReports {\n        index\n        title\n        url\n        favicon\n        siteName\n      }\n    }\n  }\n': typeof types.UpdateDashboardMediaReportsDocument
  '\n  mutation UpdateDashboardThirdPartyAnalytics(\n    $community: String!\n    $thirdPartyAnalytics: [DsbThirdPartyAnalyticsInput]\n  ) {\n    updateDashboardThirdPartyAnalytics(\n      community: $community\n      thirdPartyAnalytics: $thirdPartyAnalytics\n    ) {\n      thirdPartyAnalytics {\n        ...DashboardThirdPartyAnalyticsFields\n      }\n    }\n  }\n': typeof types.UpdateDashboardThirdPartyAnalyticsDocument
  '\n  mutation UpdateDashboardSeo(\n    $community: String!\n    $seoEnable: Boolean\n    $ogSiteName: String\n    $ogTitle: String\n    $ogDescription: String\n    $ogUrl: String\n    $ogImage: String\n    $ogLocale: String\n    $ogPublisher: String\n    $twTitle: String\n    $twDescription: String\n    $twUrl: String\n    $twCard: String\n    $twSite: String\n    $twImage: String\n    $twImageWidth: String\n    $twImageHeight: String\n  ) {\n    updateDashboardSeo(\n      community: $community\n      seoEnable: $seoEnable\n      ogSiteName: $ogSiteName\n      ogTitle: $ogTitle\n      ogDescription: $ogDescription\n      ogUrl: $ogUrl\n      ogImage: $ogImage\n      ogLocale: $ogLocale\n      ogPublisher: $ogPublisher\n      twTitle: $twTitle\n      twDescription: $twDescription\n      twUrl: $twUrl\n      twCard: $twCard\n      twSite: $twSite\n      twImage: $twImage\n      twImageWidth: $twImageWidth\n      twImageHeight: $twImageHeight\n    ) {\n      seo {\n        seoEnable\n      }\n    }\n  }\n': typeof types.UpdateDashboardSeoDocument
  '\n  mutation UpdateDashboardEnable(\n    $community: String!\n    $post: Boolean\n    $blog: Boolean\n    $kanban: Boolean\n    $changelog: Boolean\n    $doc: Boolean\n    $docLastUpdate: Boolean\n    $docReaction: Boolean\n    $about: Boolean\n    $aboutTechstack: Boolean\n    $aboutLocation: Boolean\n    $aboutLinks: Boolean\n    $aboutMediaReport: Boolean\n    $visitorLocationMap: Boolean\n  ) {\n    updateDashboardEnable(\n      community: $community\n      post: $post\n      blog: $blog\n      kanban: $kanban\n      changelog: $changelog\n      doc: $doc\n      docLastUpdate: $docLastUpdate\n      docReaction: $docReaction\n      about: $about\n      aboutTechstack: $aboutTechstack\n      aboutLocation: $aboutLocation\n      aboutLinks: $aboutLinks\n      aboutMediaReport: $aboutMediaReport\n      visitorLocationMap: $visitorLocationMap\n    ) {\n      enable {\n        post\n        blog\n        kanban\n        changelog\n        doc\n        docLastUpdate\n        docReaction\n        about\n        aboutTechstack\n        aboutLocation\n        aboutLinks\n        aboutMediaReport\n        visitorLocationMap\n      }\n    }\n  }\n': typeof types.UpdateDashboardEnableDocument
  '\n  mutation UpdateDashboardSocialLinks($community: String!, $socialLinks: [DsbSocialLinkMap]) {\n    updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {\n      socialLinks {\n        type\n        link\n      }\n    }\n  }\n': typeof types.UpdateDashboardSocialLinksDocument
  '\n  mutation UpdateDashboardNameAlias($community: String!, $nameAlias: [DsbAliasMap]) {\n    updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {\n      nameAlias {\n        original\n        name\n        slug\n        group\n      }\n    }\n  }\n': typeof types.UpdateDashboardNameAliasDocument
  '\n  mutation UpdateDashboardDocFaq($community: String!, $docFaq: DsbDocFaqInput!) {\n    updateDashboardDocFaq(community: $community, docFaq: $docFaq) {\n      docFaq {\n        title\n        desc\n        groupedView\n        groupItems {\n          id\n          title\n          index\n          items {\n            id\n            title\n            detail\n            index\n          }\n        }\n        flatItems {\n          id\n          title\n          detail\n          index\n        }\n      }\n    }\n  }\n': typeof types.UpdateDashboardDocFaqDocument
  '\n  mutation UpdateDashboardHeaderLinks($community: String!, $headerLinks: [DsbLinkMap]) {\n    updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {\n      headerLinks {\n        ...DashboardHeaderLinkFields\n      }\n    }\n  }\n': typeof types.UpdateDashboardHeaderLinksDocument
  '\n  mutation UpdateDashboardFooterLinks($community: String!, $footerLinks: [DsbLinkMap]) {\n    updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {\n      footerLinks {\n        ...DashboardHeaderLinkFields\n      }\n    }\n  }\n': typeof types.UpdateDashboardFooterLinksDocument
  '\n  mutation UpdateDashboardFooterOnelineLinks(\n    $community: String!\n    $footerOnelineLinks: [DsbLinkChildMap]\n  ) {\n    updateDashboardFooterOnelineLinks(\n      community: $community\n      footerOnelineLinks: $footerOnelineLinks\n    ) {\n      footerOnelineLinks {\n        ...DashboardFooterOnelineLinkFields\n      }\n    }\n  }\n': typeof types.UpdateDashboardFooterOnelineLinksDocument
  '\n  query DashboardCommunityBaseInfo($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      dashboard {\n        baseInfo {\n          title\n          locale\n          favicon\n          logo\n          slug\n          desc\n          introduction\n          homepage\n          city\n          techstack\n        }\n        mediaReports {\n          url\n          title\n          siteName\n          favicon\n          index\n        }\n      }\n    }\n  }\n': typeof types.DashboardCommunityBaseInfoDocument
  '\n  query DashboardCommunitySocialLinks($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      dashboard {\n        socialLinks {\n          type\n          link\n        }\n      }\n    }\n  }\n': typeof types.DashboardCommunitySocialLinksDocument
  '\n  query DashboardCommunityOverview($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      views\n      subscribersCount\n      meta {\n        postsCount\n        changelogsCount\n        docsCount\n      }\n    }\n  }\n': typeof types.DashboardCommunityOverviewDocument
  '\n  query DashboardCommunityTagGroups($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n': typeof types.DashboardCommunityTagGroupsDocument
  '\n  mutation DashboardUpdateCommunityTag(\n    $id: ID!\n    $color: RainbowColor\n    $title: String\n    $slug: String\n    $community: String!\n    $extra: [String]\n    $marker: MarkerInput\n    $groupId: ID\n  ) {\n    updateCommunityTag(\n      id: $id\n      color: $color\n      title: $title\n      slug: $slug\n      community: $community\n      extra: $extra\n      marker: $marker\n      groupId: $groupId\n    ) {\n      id\n      title\n      slug\n      color\n      groupId\n      extra\n      marker {\n        type\n        provider\n        name\n        src\n        unified\n      }\n    }\n  }\n': typeof types.DashboardUpdateCommunityTagDocument
  '\n  mutation DashboardCreateCommunityTagGroup(\n    $thread: Thread!\n    $title: String!\n    $community: String!\n  ) {\n    createCommunityTagGroup(thread: $thread, title: $title, community: $community) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n': typeof types.DashboardCreateCommunityTagGroupDocument
  '\n  mutation DashboardUpdateCommunityTagGroup(\n    $id: ID!\n    $title: String!\n    $community: String!\n    $thread: Thread\n  ) {\n    updateCommunityTagGroup(id: $id, title: $title, community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n': typeof types.DashboardUpdateCommunityTagGroupDocument
  '\n  mutation DashboardCreateCommunityTag(\n    $thread: Thread!\n    $title: String!\n    $slug: String!\n    $layout: String\n    $color: RainbowColor!\n    $groupId: ID!\n    $community: String!\n    $marker: MarkerInput\n  ) {\n    createCommunityTag(\n      thread: $thread\n      title: $title\n      slug: $slug\n      layout: $layout\n      color: $color\n      groupId: $groupId\n      community: $community\n      marker: $marker\n    ) {\n      id\n    }\n  }\n': typeof types.DashboardCreateCommunityTagDocument
  '\n  mutation DashboardReindexTagsInGroup(\n    $community: String!\n    $thread: Thread\n    $groupId: ID!\n    $tags: [ReindexTagInput]\n  ) {\n    reindexTagsInGroup(community: $community, thread: $thread, groupId: $groupId, tags: $tags) {\n      done\n    }\n  }\n': typeof types.DashboardReindexTagsInGroupDocument
  '\n  mutation DashboardReindexCommunityTags(\n    $community: String!\n    $thread: Thread\n    $tags: [ReindexCommunityTagInput]\n  ) {\n    reindexCommunityTags(community: $community, thread: $thread, tags: $tags) {\n      done\n    }\n  }\n': typeof types.DashboardReindexCommunityTagsDocument
  '\n  mutation DashboardReindexCommunityTagGroups(\n    $community: String!\n    $thread: Thread\n    $groups: [ReindexCommunityTagGroupInput]\n  ) {\n    reindexCommunityTagGroups(community: $community, thread: $thread, groups: $groups) {\n      done\n    }\n  }\n': typeof types.DashboardReindexCommunityTagGroupsDocument
  '\n  fragment KanbanAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n': typeof types.KanbanAuthorFieldsFragmentDoc
  '\n  fragment KanbanPageFields on PagedPosts {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n': typeof types.KanbanPageFieldsFragmentDoc
  '\n  query GroupedKanbanPosts($community: String!) {\n    groupedKanbanPosts(community: $community) {\n      backlog {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      todo {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      wip {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      done {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      rejected {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n    }\n  }\n': typeof types.GroupedKanbanPostsDocument
  '\n  query UserPassport($login: String!) {\n    user(login: $login) {\n      passportString\n      social {\n        github\n        twitter\n        zhihu\n      }\n    }\n  }\n': typeof types.UserPassportDocument
  '\n  query AllPassportRules {\n    allPassportRulesString {\n      cms\n    }\n  }\n': typeof types.AllPassportRulesDocument
  '\n  mutation UpdateModeratorPassport($community: String!, $user: String!, $rules: Json!) {\n    updateModeratorPassport(community: $community, user: $user, rules: $rules) {\n      slug\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n': typeof types.UpdateModeratorPassportDocument
  '\n  mutation RemoveModerator($community: String!, $user: String!) {\n    removeModerator(community: $community, user: $user) {\n      slug\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n': typeof types.RemoveModeratorDocument
  '\n    query PostThreadFresh($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n      post(article: $article) {\n        innerId\n        views\n        upvotesCount\n        commentsCount\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n    }\n  ': typeof types.PostThreadFreshDocument
  '\n  query RichEditorSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n': typeof types.RichEditorSimpleQueryDocument
  '\n  mutation DeleteCommunityTag($id: ID!, $community: String!, $thread: Thread) {\n    deleteCommunityTag(id: $id, community: $community, thread: $thread) {\n      id\n    }\n  }\n': typeof types.DeleteCommunityTagDocument
  '\n  mutation CreateCommunityTag(\n    $thread: Thread!\n    $title: String!\n    $slug: String!\n    $layout: String\n    $color: RainbowColor!\n    $groupId: ID!\n    $community: String!\n    $marker: MarkerInput\n  ) {\n    createCommunityTag(\n      thread: $thread\n      title: $title\n      slug: $slug\n      layout: $layout\n      color: $color\n      groupId: $groupId\n      community: $community\n      marker: $marker\n    ) {\n      id\n    }\n  }\n': typeof types.CreateCommunityTagDocument
  '\n  mutation UpdateCommunityTag(\n    $id: ID!\n    $color: RainbowColor\n    $title: String\n    $layout: String\n    $desc: String\n    $slug: String\n    $community: String!\n    $groupId: ID\n    $marker: MarkerInput\n  ) {\n    updateCommunityTag(\n      id: $id\n      color: $color\n      title: $title\n      desc: $desc\n      layout: $layout\n      slug: $slug\n      community: $community\n      groupId: $groupId\n      marker: $marker\n    ) {\n      id\n    }\n  }\n': typeof types.UpdateCommunityTagDocument
}
const documents: Documents = {
  '\n  mutation QueryUpvotePost($article: ArticlePathInput!) {\n    upvotePost(article: $article) {\n      innerId\n      upvotesCount\n      ... on Post {\n        viewerHasUpvoted\n      }\n    }\n  }\n':
    types.QueryUpvotePostDocument,
  '\n  mutation QueryUndoUpvotePost($article: ArticlePathInput!) {\n    undoUpvotePost(article: $article) {\n      innerId\n      upvotesCount\n      ... on Post {\n        viewerHasUpvoted\n      }\n    }\n  }\n':
    types.QueryUndoUpvotePostDocument,
  '\n  mutation QueryUpvoteChangelog($article: ArticlePathInput!) {\n    upvoteChangelog(article: $article) {\n      innerId\n      upvotesCount\n      ... on Changelog {\n        viewerHasUpvoted\n      }\n    }\n  }\n':
    types.QueryUpvoteChangelogDocument,
  '\n  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!) {\n    undoUpvoteChangelog(article: $article) {\n      innerId\n      upvotesCount\n      ... on Changelog {\n        viewerHasUpvoted\n      }\n    }\n  }\n':
    types.QueryUndoUpvoteChangelogDocument,
  '\n  mutation QueryUpvoteDoc($article: ArticlePathInput!) {\n    upvoteDoc(article: $article) {\n      innerId\n      upvotesCount\n      ... on Doc {\n        viewerHasUpvoted\n      }\n    }\n  }\n':
    types.QueryUpvoteDocDocument,
  '\n  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!) {\n    undoUpvoteDoc(article: $article) {\n      innerId\n      upvotesCount\n      ... on Doc {\n        viewerHasUpvoted\n      }\n    }\n  }\n':
    types.QueryUndoUpvoteDocDocument,
  '\n  query ViewerArticleStates($filter: PagedPostsFilter!) {\n    pagedPosts(filter: $filter) {\n      entries {\n        innerId\n        community {\n          slug\n        }\n        meta {\n          thread\n        }\n        viewerHasViewed\n        viewerHasUpvoted\n      }\n    }\n  }\n':
    types.ViewerArticleStatesDocument,
  '\n  query ViewerChangelogStates($filter: PagedChangelogsFilter!) {\n    pagedChangelogs(filter: $filter) {\n      entries {\n        innerId\n        community {\n          slug\n        }\n        meta {\n          thread\n        }\n        viewerHasViewed\n        viewerHasUpvoted\n      }\n    }\n  }\n':
    types.ViewerChangelogStatesDocument,
  '\n  query PostViewerState($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n':
    types.PostViewerStateDocument,
  '\n  query ChangelogViewerState($article: ArticlePathInput!) {\n    changelog(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n':
    types.ChangelogViewerStateDocument,
  '\n  query DocViewerState($article: ArticlePathInput!) {\n    doc(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n':
    types.DocViewerStateDocument,
  '\n  mutation SetCommunityTag($article: ArticlePathInput!, $tagId: ID!) {\n    setCommunityTag(article: $article, communityTagId: $tagId) {\n      innerId\n      title\n    }\n  }\n':
    types.SetCommunityTagDocument,
  '\n  mutation UnsetCommunityTag($article: ArticlePathInput!, $tagId: ID!) {\n    unsetCommunityTag(article: $article, communityTagId: $tagId) {\n      innerId\n      title\n    }\n  }\n':
    types.UnsetCommunityTagDocument,
  '\n  mutation Follow($login: String!) {\n    follow(login: $login) {\n      login\n      viewerHasFollowed\n    }\n  }\n':
    types.FollowDocument,
  '\n  mutation UndoFollow($login: String!) {\n    undoFollow(login: $login) {\n      login\n      viewerHasFollowed\n    }\n  }\n':
    types.UndoFollowDocument,
  '\n  query CommunityActivityConfig($community: String!) {\n    communityActivityConfig(community: $community) {\n      resources {\n        resourceType\n        actions {\n          action\n          messageKey\n          category\n          highRisk\n        }\n      }\n      sources\n      actorTypes\n      presets {\n        key\n        questionKey\n        descriptionKey\n        coverageNoteKey\n        defaultTimeRange {\n          amount\n          unit\n        }\n      }\n    }\n  }\n':
    types.CommunityActivityConfigDocument,
  '\n  mutation ExportCommunityActivity(\n    $community: String!\n    $selection: CommunityActivitySelectionInput!\n    $format: CommunityActivityExportFormat!\n  ) {\n    exportCommunityActivity(community: $community, selection: $selection, format: $format) {\n      content\n      filename\n      mimeType\n      totalCount\n      exportedCount\n      manifest\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n':
    types.ExportCommunityActivityDocument,
  '\n  query CommunityActivityEvent($community: String!, $eventRef: ID!) {\n    communityActivityEvent(community: $community, eventRef: $eventRef) {\n      id\n      eventRef\n      operationRef\n      parentEventRef\n      operationIndex\n      recordSequence\n      messageKey\n      action\n      category\n      highRisk\n      outcome\n      denialCode\n      changedFields\n      resource {\n        type\n        ref\n        title\n        innerId\n      }\n      actor {\n        type\n        id\n        login\n        nickname\n        avatar\n      }\n      onBehalfOf {\n        type\n        id\n        login\n        nickname\n        avatar\n      }\n      subject {\n        type\n        ref\n        title\n        innerId\n      }\n      target {\n        type\n        ref\n        title\n        innerId\n      }\n      source\n      payload\n      metadata\n      occurredAt\n      recordedAt\n      parentEvent {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n      childEvents {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n    }\n  }\n':
    types.CommunityActivityEventDocument,
  '\n  query CommunityActivity(\n    $community: String!\n    $selection: CommunityActivitySelectionInput!\n    $page: Int = 1\n  ) {\n    communityActivity(community: $community, selection: $selection, page: $page) {\n      entries {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        onBehalfOf {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n      totalCount\n      totalPages\n      pageNumber\n      pageSize\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n':
    types.CommunityActivityDocument,
  '\n  query CommunityActivityStats($community: String!, $selection: CommunityActivitySelectionInput!) {\n    communityActivityStats(community: $community, selection: $selection) {\n      granularity\n      timezone\n      totalCount\n      buckets {\n        startedAt\n        endedAt\n        count\n      }\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n':
    types.CommunityActivityStatsDocument,
  '\n  fragment PageAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n':
    types.PageAuthorFieldsFragmentDoc,
  '\n  fragment PageCommonUserFields on CommonUser {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n':
    types.PageCommonUserFieldsFragmentDoc,
  '\n  fragment PageCommunityFields on Community {\n    title\n    slug\n    index\n    desc\n    logo\n    subscribersCount\n    homepage\n    articlesCount\n    views\n    pending\n    insertedAt\n    updatedAt\n  }\n':
    types.PageCommunityFieldsFragmentDoc,
  '\n  fragment PageTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n':
    types.PageTagFieldsFragmentDoc,
  '\n  fragment PagePostFields on Post {\n    innerId\n    version\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n':
    types.PagePostFieldsFragmentDoc,
  '\n  fragment PagePostDetailFields on Post {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n':
    types.PagePostDetailFieldsFragmentDoc,
  '\n  fragment PageChangelogFields on Changelog {\n    innerId\n    version\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n':
    types.PageChangelogFieldsFragmentDoc,
  '\n  fragment PageChangelogDetailFields on Changelog {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n':
    types.PageChangelogDetailFieldsFragmentDoc,
  '\n  fragment PagePostPageInfo on PagedPosts {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n':
    types.PagePostPageInfoFragmentDoc,
  '\n  fragment PageChangelogPageInfo on PagedChangelogs {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n':
    types.PageChangelogPageInfoFragmentDoc,
  '\n  fragment PageDocFields on Doc {\n    innerId\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n':
    types.PageDocFieldsFragmentDoc,
  '\n  fragment PageDocDetailFields on Doc {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n':
    types.PageDocDetailFieldsFragmentDoc,
  '\n  fragment PageDocPageInfo on PagedDocs {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n':
    types.PageDocPageInfoFragmentDoc,
  '\n  fragment PageCommunityPageInfo on PagedCommunities {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n':
    types.PageCommunityPageInfoFragmentDoc,
  '\n  query Changelog($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    changelog(article: $article) {\n      ...PageChangelogFields\n      ...PageChangelogDetailFields\n    }\n  }\n':
    types.ChangelogDocument,
  '\n  query PagedChangelogs($filter: PagedChangelogsFilter!, $userHasLogin: Boolean!) {\n    pagedChangelogs(filter: $filter) {\n      entries {\n        ...PageChangelogFields\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        digest\n        linkAddr\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PageChangelogPageInfo\n    }\n  }\n':
    types.PagedChangelogsDocument,
  '\n  query PageSubscribedCommunities($login: String, $filter: PagiFilter!) {\n    subscribedCommunities(login: $login, filter: $filter) {\n      entries {\n        ...PageCommunityFields\n        contributesDigest\n      }\n      ...PageCommunityPageInfo\n    }\n  }\n':
    types.PageSubscribedCommunitiesDocument,
  '\n  query PageCommunity($slug: String!, $userHasLogin: Boolean!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      title\n      slug\n      index\n      desc\n      logo\n      subscribersCount\n      homepage\n      articlesCount\n      views\n      pending\n      insertedAt\n      updatedAt\n      viewerHasSubscribed @include(if: $userHasLogin)\n      contributesDigest\n      moderatorsCount\n      meta {\n        postsCount\n        blogsCount\n      }\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n      dashboard {\n        baseInfo {\n          title\n          slug\n          locale\n          favicon\n          homepage\n          logo\n          desc\n          city\n          techstack\n          introduction\n        }\n        mediaReports {\n          url\n          title\n          siteName\n          favicon\n          index\n        }\n        thirdPartyAnalytics {\n          provider\n          enabled\n          measurementId\n          containerId\n          projectId\n          domain\n          siteId\n        }\n        enabledThirdPartyAnalytics {\n          provider\n          enabled\n          measurementId\n          containerId\n          projectId\n          domain\n          siteId\n        }\n        umamiWebsiteId\n        docFaq {\n          title\n          desc\n          groupedView\n          groupItems {\n            id\n            title\n            index\n            items {\n              id\n              title\n              detail\n              index\n            }\n          }\n          flatItems {\n            id\n            title\n            detail\n            index\n          }\n        }\n        wallpaper {\n          light {\n            type\n            source\n            gradient\n            pattern\n            contentShadow\n            effect\n            texture\n          }\n          dark {\n            type\n            source\n            gradient\n            pattern\n            contentShadow\n            effect\n            texture\n          }\n        }\n        headerLinks {\n          id\n          type\n          title\n          url\n          links {\n            id\n            title\n            url\n          }\n        }\n        footerLinks {\n          id\n          type\n          title\n          url\n          links {\n            id\n            title\n            url\n          }\n        }\n        footerOnelineLinks {\n          id\n          title\n          url\n        }\n        socialLinks {\n          type\n          link\n        }\n        seo {\n          seoEnable\n          ogSiteName\n          ogTitle\n          ogDescription\n          ogUrl\n          ogImage\n          twTitle\n          twDescription\n          twUrl\n          twCard\n          twSite\n          twImage\n          twImageWidth\n          twImageHeight\n        }\n        nameAlias {\n          slug\n          name\n          original\n          group\n        }\n        layout {\n          themePreset\n          themePresetBase\n          themeTokens\n          themePresets {\n            value\n            tokens\n          }\n          postLayout\n          docCoverLayout\n          docFaqLayout\n          tagLayout\n          inlineTagLayout\n          avatarLayout\n          brandLayout\n          communityLayout\n          navActiveLayout\n          topbarEnabled\n          topbarBg\n          topbarBgCustomColor\n          broadcastLayout\n          broadcastBg\n          broadcastCustomBg\n          broadcastArticleBg\n          broadcastArticleCustomBg\n          kanbanLayout\n          kanbanCardLayout\n          kanbanBoards\n          kanbanBgColors\n          changelogLayout\n          headerLayout\n          footerLayout\n          overlayDark\n          broadcastEnable\n        }\n        enable {\n          post\n          kanban\n          changelog\n          doc\n          docLastUpdate\n          docReaction\n          about\n          aboutTechstack\n          aboutLocation\n          aboutLinks\n          aboutMediaReport\n          visitorLocationMap\n        }\n      }\n    }\n  }\n':
    types.PageCommunityDocument,
  '\n  query PagePagedCommunities($filter: CommunitiesFilter!, $userHasLogin: Boolean!) {\n    pagedCommunities(filter: $filter) {\n      entries {\n        ...PageCommunityFields\n        contributesDigest\n        viewerHasSubscribed @include(if: $userHasLogin)\n      }\n      ...PageCommunityPageInfo\n    }\n  }\n':
    types.PagePagedCommunitiesDocument,
  '\n  fragment PageDocPublicTreeNodeFields on DocPublicTreeNode {\n    id\n    parentNodeId\n    docId\n    type\n    title\n    index\n    href\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n      appearance {\n        light {\n          color\n          bg\n        }\n        dark {\n          color\n          bg\n        }\n      }\n    }\n    badge\n  }\n':
    types.PageDocPublicTreeNodeFieldsFragmentDoc,
  '\n  fragment PageDocPublicTreeChildFields on DocPublicTreeNode {\n    ...PageDocPublicTreeNodeFields\n    pages {\n      ...PageDocPublicTreeNodeFields\n    }\n  }\n':
    types.PageDocPublicTreeChildFieldsFragmentDoc,
  '\n  fragment PageDocPublicTreeGroupFields on DocPublicTreeNode {\n    ...PageDocPublicTreeNodeFields\n    pages {\n      ...PageDocPublicTreeChildFields\n    }\n  }\n':
    types.PageDocPublicTreeGroupFieldsFragmentDoc,
  '\n  query PageDoc($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    doc(article: $article) {\n      ...PageDocFields\n      subtitle\n      ...PageDocDetailFields\n    }\n  }\n':
    types.PageDocDocument,
  '\n  query PageDocPublicTree($community: String!) {\n    docPublicTree(community: $community) {\n      tabs {\n        ...PageDocPublicTreeNodeFields\n        pins {\n          ...PageDocPublicTreeNodeFields\n        }\n        groups {\n          ...PageDocPublicTreeGroupFields\n        }\n      }\n    }\n  }\n':
    types.PageDocPublicTreeDocument,
  '\n  query PagePagedDocs($filter: PagedDocsFilter!, $userHasLogin: Boolean!) {\n    pagedDocs(filter: $filter) {\n      entries {\n        ...PageDocFields\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PageDocPageInfo\n    }\n  }\n':
    types.PagePagedDocsDocument,
  '\n  fragment PageCategoryPageInfo on PagedCategories {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n':
    types.PageCategoryPageInfoFragmentDoc,
  '\n  query PageCommunityTagGroups($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...PageTagFields\n      }\n    }\n  }\n':
    types.PageCommunityTagGroupsDocument,
  '\n  query CommunityTagStats($community: String!, $thread: Thread!, $slug: String!) {\n    communityTagStats(community: $community, thread: $thread, slug: $slug) {\n      contentsCount\n      todayContentsCount\n    }\n  }\n':
    types.CommunityTagStatsDocument,
  '\n  query ThemePresets {\n    themePresets {\n      value\n      tokens\n    }\n  }\n':
    types.ThemePresetsDocument,
  '\n  query PagePagedCategories($filter: PagiFilter!) {\n    pagedCategories(filter: $filter) {\n      entries {\n        id\n        title\n        slug\n        index\n      }\n      ...PageCategoryPageInfo\n    }\n  }\n':
    types.PagePagedCategoriesDocument,
  '\n  query Post($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    post(article: $article) {\n      ...PagePostFields\n      ...PagePostDetailFields\n    }\n  }\n':
    types.PostDocument,
  '\n  query PagedPosts($filter: PagedPostsFilter!, $userHasLogin: Boolean!) {\n    pagedPosts(filter: $filter) {\n      entries {\n        ...PagePostFields\n        cat\n        status\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        digest\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PagePostPageInfo\n    }\n  }\n':
    types.PagedPostsDocument,
  '\n  query PagedPublishedPosts($login: String!, $filter: PagiFilter!, $userHasLogin: Boolean!) {\n    pagedPublishedPosts(login: $login, filter: $filter) {\n      entries {\n        ...PagePostFields\n        meta {\n          thread\n        }\n        digest\n        linkAddr\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PagePostPageInfo\n    }\n  }\n':
    types.PagedPublishedPostsDocument,
  '\n  query PagesGroupedKanbanPosts($community: String!) {\n    groupedKanbanPosts(community: $community) {\n      backlog {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      todo {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      wip {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      done {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      rejected {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n    }\n  }\n':
    types.PagesGroupedKanbanPostsDocument,
  '\n  fragment UserAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n':
    types.UserAuthorFieldsFragmentDoc,
  '\n  fragment UserSocialFields on SocialMap {\n    github\n    twitter\n    company\n    blog\n  }\n':
    types.UserSocialFieldsFragmentDoc,
  '\n  fragment UserAchievementFields on Achievement {\n    reputation\n    articlesUpvotesCount\n    articlesCollectsCount\n  }\n':
    types.UserAchievementFieldsFragmentDoc,
  '\n  query Me {\n    me {\n      login\n      nickname\n      avatar\n      bio\n      passport\n    }\n  }\n':
    types.MeDocument,
  '\n  query User($login: String!, $userHasLogin: Boolean!) {\n    user(login: $login) {\n      ...UserAuthorFields\n      views\n      sex\n      location\n      social {\n        ...UserSocialFields\n      }\n      meta {\n        isMaker\n        publishedPostsCount\n        publishedBlogsCount\n      }\n      followersCount\n      followingsCount\n      viewerHasFollowed @include(if: $userHasLogin)\n      achievement {\n        ...UserAchievementFields\n      }\n      contributes {\n        records {\n          count\n          date\n        }\n        startDate\n        endDate\n        totalCount\n      }\n\n      subscribedCommunitiesCount\n\n      insertedAt\n    }\n  }\n':
    types.UserDocument,
  '\n  query SessionState {\n    sessionState {\n      isValid\n      user {\n        ...UserAuthorFields\n        geoCity\n        location\n        social {\n          ...UserSocialFields\n        }\n        passport\n        subscribedCommunitiesCount\n        achievement {\n          ...UserAchievementFields\n        }\n      }\n    }\n  }\n':
    types.SessionStateDocument,
  '\n  query AboutSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n':
    types.AboutSimpleQueryDocument,
  '\n  fragment ArticleEditorAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n':
    types.ArticleEditorAuthorFieldsFragmentDoc,
  '\n  fragment ArticleEditorCommunityFields on Community {\n    title\n    slug\n    index\n    desc\n    logo\n    subscribersCount\n    homepage\n    articlesCount\n    views\n    pending\n    insertedAt\n    updatedAt\n  }\n':
    types.ArticleEditorCommunityFieldsFragmentDoc,
  '\n  fragment ArticleEditorTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n':
    types.ArticleEditorTagFieldsFragmentDoc,
  '\n  mutation CreatePost(\n    $title: String!\n    $bodyBag: ArtimentBodyBagInput!\n    $community: String!\n    $communityTags: [ID]\n    $linkAddr: String\n    $copyRight: String\n  ) {\n    createPost(\n      title: $title\n      bodyBag: $bodyBag\n      community: $community\n      communityTags: $communityTags\n      linkAddr: $linkAddr\n      copyRight: $copyRight\n    ) {\n      innerId\n      title\n      meta {\n        thread\n      }\n    }\n  }\n':
    types.CreatePostDocument,
  '\n  mutation UpdatePostFromEditor(\n    $article: ArticlePathInput!\n    $expectedVersion: Int!\n    $title: String\n    $bodyBag: ArtimentBodyBagInput\n    $linkAddr: String\n    $copyRight: String\n    $communityTags: [ID]\n  ) {\n    updatePost(\n      article: $article\n      expectedVersion: $expectedVersion\n      title: $title\n      bodyBag: $bodyBag\n      linkAddr: $linkAddr\n      copyRight: $copyRight\n      communityTags: $communityTags\n    ) {\n      innerId\n      title\n      author {\n        ...ArticleEditorAuthorFields\n      }\n      meta {\n        thread\n        isLegal\n        illegalReason\n        illegalWords\n      }\n    }\n  }\n':
    types.UpdatePostFromEditorDocument,
  '\n  query ArticleEditorCommunity($slug: String!) {\n    community(slug: $slug) {\n      logo\n      title\n      slug\n      desc\n      subscribersCount\n    }\n  }\n':
    types.ArticleEditorCommunityDocument,
  '\n  query ArticleEditorPost($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n      version\n      title\n      linkAddr\n      copyRight\n      lifecycle {\n        state\n        archivedAt\n      }\n      author {\n        ...ArticleEditorAuthorFields\n      }\n      community {\n        ...ArticleEditorCommunityFields\n      }\n      communityTags {\n        ...ArticleEditorTagFields\n      }\n      meta {\n        thread\n        isLegal\n        illegalReason\n        illegalWords\n      }\n      document {\n        json\n      }\n    }\n  }\n':
    types.ArticleEditorPostDocument,
  '\n  fragment ArticleMenuTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n':
    types.ArticleMenuTagFieldsFragmentDoc,
  '\n  mutation UpdatePostFromMenu(\n    $article: ArticlePathInput!\n    $expectedVersion: Int!\n    $title: String\n    $communityTags: [ID]\n  ) {\n    updatePost(\n      article: $article\n      expectedVersion: $expectedVersion\n      title: $title\n      communityTags: $communityTags\n    ) {\n      innerId\n      title\n      communityTags {\n        ...ArticleMenuTagFields\n      }\n    }\n  }\n':
    types.UpdatePostFromMenuDocument,
  '\n  mutation SetPostCat($article: ArticlePathInput!, $cat: ArticleCatEnum!) {\n    setPostCat(article: $article, cat: $cat) {\n      innerId\n      cat\n    }\n  }\n':
    types.SetPostCatDocument,
  '\n  mutation SetPostStatus($article: ArticlePathInput!, $status: ArticleStatusEnum!) {\n    setPostStatus(article: $article, status: $status) {\n      innerId\n      status\n    }\n  }\n':
    types.SetPostStatusDocument,
  '\n  mutation PinPost($article: ArticlePathInput!) {\n    pinPost(article: $article) {\n      innerId\n    }\n  }\n':
    types.PinPostDocument,
  '\n  mutation UndoPinPost($article: ArticlePathInput!) {\n    undoPinPost(article: $article) {\n      innerId\n      isPinned\n    }\n  }\n':
    types.UndoPinPostDocument,
  '\n  query CommunityTagGroupsForMenu($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...ArticleMenuTagFields\n      }\n    }\n  }\n':
    types.CommunityTagGroupsForMenuDocument,
  '\n  query ChangelogSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n':
    types.ChangelogSimpleQueryDocument,
  '\n  fragment CommentAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n':
    types.CommentAuthorFieldsFragmentDoc,
  '\n  fragment CommentEmotionFields on EmotionStat {\n    type\n    count\n    viewerHasReacted\n    latestUsers {\n      login\n      nickname\n      avatar\n    }\n  }\n':
    types.CommentEmotionFieldsFragmentDoc,
  '\n  fragment CommentMetaFields on CommentMeta {\n    isLegal\n    illegalReason\n    illegalWords\n    isArticleAuthorUpvoted\n    isReplyToOthers\n  }\n':
    types.CommentMetaFieldsFragmentDoc,
  '\n  fragment CommentFields on Comment {\n    innerId\n    bodyHtml\n    author {\n      ...CommentAuthorFields\n    }\n    meta {\n      ...CommentMetaFields\n    }\n    emotions {\n      ...CommentEmotionFields\n    }\n    isPinned\n    isSolution\n    floor\n    upvotesCount\n    isArticleAuthor\n    viewerHasUpvoted\n    viewerHasReported\n    repliesCount\n    insertedAt\n    updatedAt\n  }\n':
    types.CommentFieldsFragmentDoc,
  '\n  fragment CommentReplyFields on CommentReply {\n    innerId\n    bodyHtml\n    author {\n      ...CommentAuthorFields\n    }\n    meta {\n      ...CommentMetaFields\n    }\n    emotions {\n      ...CommentEmotionFields\n    }\n    isPinned\n    isSolution\n    floor\n    upvotesCount\n    isArticleAuthor\n    viewerHasUpvoted\n    viewerHasReported\n    repliesCount\n    insertedAt\n    updatedAt\n    replyToComment {\n      ...CommentFields\n    }\n  }\n':
    types.CommentReplyFieldsFragmentDoc,
  '\n  fragment CommentPageFields on PagedComments {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n':
    types.CommentPageFieldsFragmentDoc,
  '\n  query PagedComments($article: ArticlePathInput!, $mode: CommentsMode, $filter: CommentsFilter!) {\n    pagedComments(article: $article, mode: $mode, filter: $filter) {\n      entries {\n        ...CommentFields\n        replyToComment {\n          ...CommentFields\n        }\n        replies {\n          ...CommentReplyFields\n        }\n      }\n      ...CommentPageFields\n    }\n  }\n':
    types.PagedCommentsDocument,
  '\n  query PagedCommentReplies($comment: CommentPathInput!, $filter: CommentsFilter!) {\n    pagedCommentReplies(comment: $comment, filter: $filter) {\n      entries {\n        ...CommentReplyFields\n      }\n      totalPages\n      totalCount\n      pageSize\n      pageNumber\n    }\n  }\n':
    types.PagedCommentRepliesDocument,
  '\n  mutation CreateComment($article: ArticlePathInput!, $body: String!) {\n    createComment(article: $article, body: $body) {\n      comment {\n        ...CommentFields\n      }\n      article {\n        innerId\n        commentsCount\n      }\n    }\n  }\n':
    types.CreateCommentDocument,
  '\n  mutation UpdateComment($comment: CommentPathInput!, $body: String!) {\n    updateComment(comment: $comment, body: $body) {\n      innerId\n      bodyHtml\n      replyToComment {\n        innerId\n      }\n    }\n  }\n':
    types.UpdateCommentDocument,
  '\n  query CommentsState($article: ArticlePathInput!, $freshkey: String) {\n    commentsState(article: $article, freshkey: $freshkey) {\n      totalCount\n      isViewerJoined\n      participantsCount\n      participants {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n':
    types.CommentsStateDocument,
  '\n  query OneComment($comment: CommentPathInput!) {\n    oneComment(comment: $comment) {\n      innerId\n      body\n    }\n  }\n':
    types.OneCommentDocument,
  '\n  mutation ReplyComment($comment: CommentPathInput!, $body: String!) {\n    replyComment(comment: $comment, body: $body) {\n      comment {\n        ...CommentFields\n        replyToComment {\n          ...CommentFields\n        }\n      }\n      article {\n        innerId\n        commentsCount\n      }\n    }\n  }\n':
    types.ReplyCommentDocument,
  '\n  mutation DeleteComment($comment: CommentPathInput!) {\n    deleteComment(comment: $comment) {\n      innerId\n    }\n  }\n':
    types.DeleteCommentDocument,
  '\n  mutation UpvoteComment($comment: CommentPathInput!) {\n    upvoteComment(comment: $comment) {\n      innerId\n      meta {\n        isArticleAuthorUpvoted\n      }\n      upvotesCount\n      viewerHasUpvoted\n      replyToComment {\n        innerId\n      }\n    }\n  }\n':
    types.UpvoteCommentDocument,
  '\n  mutation UndoUpvoteComment($comment: CommentPathInput!) {\n    undoUpvoteComment(comment: $comment) {\n      innerId\n      meta {\n        isArticleAuthorUpvoted\n      }\n      upvotesCount\n      viewerHasUpvoted\n      replyToComment {\n        innerId\n      }\n    }\n  }\n':
    types.UndoUpvoteCommentDocument,
  '\n  mutation ReportComment($comment: CommentPathInput!, $reason: String!, $attr: String) {\n    reportComment(comment: $comment, reason: $reason, attr: $attr) {\n      innerId\n      viewerHasReported\n      meta {\n        reportedCount\n      }\n    }\n  }\n':
    types.ReportCommentDocument,
  '\n  mutation UndoReportComment($comment: CommentPathInput!) {\n    undoReportComment(comment: $comment) {\n      innerId\n      viewerHasReported\n      meta {\n        reportedCount\n      }\n    }\n  }\n':
    types.UndoReportCommentDocument,
  '\n  mutation EmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {\n    emotionToComment(comment: $comment, emotion: $emotion) {\n      innerId\n      replyToComment {\n        innerId\n      }\n      emotions {\n        ...CommentEmotionFields\n      }\n    }\n  }\n':
    types.EmotionToCommentDocument,
  '\n  mutation UndoEmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {\n    undoEmotionToComment(comment: $comment, emotion: $emotion) {\n      innerId\n      replyToComment {\n        innerId\n      }\n      emotions {\n        ...CommentEmotionFields\n      }\n    }\n  }\n':
    types.UndoEmotionToCommentDocument,
  '\n  query SearchUsers($name: String!) {\n    searchUsers(name: $name) {\n      entries {\n        ...CommentAuthorFields\n      }\n    }\n  }\n':
    types.SearchUsersDocument,
  '\n  query PagedPublishedComments($login: String!, $thread: Thread, $filter: PagiFilter!) {\n    pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {\n      entries {\n        ...CommentFields\n        article {\n          innerId\n          title\n          thread\n          author {\n            nickname\n            login\n          }\n        }\n      }\n      ...CommentPageFields\n    }\n  }\n':
    types.PagedPublishedCommentsDocument,
  '\n  query CoverSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n':
    types.CoverSimpleQueryDocument,
  '\n  fragment DocCoverMarkerFields on Marker {\n    type\n    provider\n    name\n    src\n    unified\n    appearance {\n      light {\n        color\n        bg\n      }\n      dark {\n        color\n        bg\n      }\n    }\n  }\n':
    types.DocCoverMarkerFieldsFragmentDoc,
  '\n  fragment DocCoverItemFields on DocCoverCardItem {\n    id\n    nodeId\n    docId\n    index\n    type\n    title\n    href\n    badge\n    leafCount\n    marker {\n      ...DocCoverMarkerFields\n    }\n  }\n':
    types.DocCoverItemFieldsFragmentDoc,
  '\n  query DocCover($community: String!, $view: DocCoverView = PUBLIC) {\n    docCover(community: $community, view: $view) {\n      cards {\n        id\n        groupNodeId\n        index\n        appearance\n        title\n        items {\n          ...DocCoverItemFields\n        }\n      }\n      pinnedDocs {\n        nodeId\n        index\n        appearance\n        href\n        doc {\n          title\n          author {\n            avatar\n            nickname\n          }\n          document {\n            thumbnail\n          }\n        }\n      }\n    }\n  }\n':
    types.DocCoverDocument,
  '\n  query AnalysisActiveVisitors($community: String!) {\n    analysisActiveVisitors(community: $community) {\n      visitors\n    }\n  }\n':
    types.AnalysisActiveVisitorsDocument,
  '\n  query AnalysisTrendPages(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendPagesDimension!\n  ) {\n    analysisTrendPages(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n          bounceRate\n          visitDuration\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n':
    types.AnalysisTrendPagesDocument,
  '\n  query AnalysisTrendSources(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendSourcesDimension!\n  ) {\n    analysisTrendSources(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n':
    types.AnalysisTrendSourcesDocument,
  '\n  query AnalysisTrendEnvironment(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendEnvironmentDimension!\n  ) {\n    analysisTrendEnvironment(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n          percentage\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n':
    types.AnalysisTrendEnvironmentDocument,
  '\n  query AnalysisTrendLocation(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendLocationDimension!\n  ) {\n    analysisTrendLocation(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        code\n        metrics {\n          visitors\n          visits\n          views\n          percentage\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n':
    types.AnalysisTrendLocationDocument,
  '\n  query AnalysisTrendTraffic($community: String!, $days: Int) {\n    analysisTrendTraffic(community: $community, days: $days) {\n      status\n      timezone\n      cells {\n        weekday\n        hour\n        visitors\n        visits\n        views\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n':
    types.AnalysisTrendTrafficDocument,
  '\n  query AnalysisTrendsOverview($community: String!, $days: Int) {\n    analysisTrendsOverview(community: $community, days: $days) {\n      status\n      provider\n      range {\n        days\n        startAt\n        endAt\n        bucket\n      }\n      summary {\n        pageviews {\n          value\n          previousValue\n          changeRate\n        }\n        visitors {\n          value\n          previousValue\n          changeRate\n        }\n        visits {\n          value\n          previousValue\n          changeRate\n        }\n        bounceRate {\n          value\n          previousValue\n          changeRate\n        }\n        visitDuration {\n          value\n          previousValue\n          changeRate\n        }\n      }\n      chart {\n        bucket\n        points {\n          timestamp\n          visits\n          views\n        }\n      }\n      errors {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n':
    types.AnalysisTrendsOverviewDocument,
  '\n  mutation SaveCustomThemePreset(\n    $community: String!\n    $themePreset: DsbThemePreset!\n    $themePresetBase: DsbThemePreset!\n    $themeOverwrite: Json\n  ) {\n    saveCustomThemePreset(\n      community: $community\n      themePreset: $themePreset\n      themePresetBase: $themePresetBase\n      themeOverwrite: $themeOverwrite\n    ) {\n      layout {\n        themePreset\n        themePresetBase\n        themeTokens\n        themePresets {\n          value\n          tokens\n        }\n      }\n    }\n  }\n':
    types.SaveCustomThemePresetDocument,
  '\n  mutation SelectThemePreset($community: String!, $themePreset: DsbThemePreset!) {\n    selectThemePreset(community: $community, themePreset: $themePreset) {\n      layout {\n        themePreset\n        themePresetBase\n        themeTokens\n        themePresets {\n          value\n          tokens\n        }\n      }\n    }\n  }\n':
    types.SelectThemePresetDocument,
  '\n  fragment DashboardWallpaperFields on DsbWallpaper {\n    light {\n      type\n      source\n      gradient\n      pattern\n      contentShadow\n      effect\n      texture\n    }\n    dark {\n      type\n      source\n      gradient\n      pattern\n      contentShadow\n      effect\n      texture\n    }\n  }\n':
    types.DashboardWallpaperFieldsFragmentDoc,
  '\n  mutation UpdateDashboardWallpaper($community: String!, $wallpaper: DsbWallpaperInput!) {\n    updateDashboardWallpaper(community: $community, wallpaper: $wallpaper) {\n      wallpaper {\n        ...DashboardWallpaperFields\n      }\n    }\n  }\n':
    types.UpdateDashboardWallpaperDocument,
  '\n  fragment ContentImportJobFields on ContentImportJob {\n    id\n    status\n    progress\n    process {\n      state\n      stage\n      progress {\n        completed\n        total\n        unit\n      }\n      recentBatch {\n        ref\n        label\n        state\n      }\n      updatedAt\n    }\n    errorCode\n    errorMessage\n    failedItems\n    skipped\n    targetBranch\n    firstImportedDocRef\n    sourceInfo {\n      repo\n      repoUrl\n      branch\n      commit\n      framework\n      contentRoot\n      configPaths\n    }\n    counts {\n      tabs\n      groups\n      pages\n      links\n      assets\n    }\n    tree\n    badSmells\n  }\n':
    types.ContentImportJobFieldsFragmentDoc,
  '\n  query ContentImportJob($community: String!, $jobRef: ID!) {\n    contentImportJob(community: $community, jobRef: $jobRef) {\n      ...ContentImportJobFields\n    }\n  }\n':
    types.ContentImportJobDocument,
  '\n  query DashboardCommunityModerators($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n':
    types.DashboardCommunityModeratorsDocument,
  '\n  query DashboardUserPassport($login: String!) {\n    user(login: $login) {\n      passportString\n    }\n  }\n':
    types.DashboardUserPassportDocument,
  '\n  query DashboardSearchUsers($name: String!) {\n    searchUsers(name: $name) {\n      entries {\n        login\n        avatar\n        nickname\n        bio\n        social {\n          github\n          twitter\n          zhihu\n        }\n      }\n    }\n  }\n':
    types.DashboardSearchUsersDocument,
  '\n  mutation DashboardAddModerator($community: String!, $user: String!) {\n    addModerator(community: $community, user: $user) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n':
    types.DashboardAddModeratorDocument,
  '\n  mutation DashboardAddModerators($community: String!, $users: [String!]!) {\n    addModerators(community: $community, users: $users) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n':
    types.DashboardAddModeratorsDocument,
  '\n  mutation UpdateDashboardLayout(\n    $community: String!\n    $postLayout: DsbPostLayout\n    $kanbanLayout: DsbKanbanLayout\n    $kanbanCardLayout: DsbKanbanCardLayout\n    $kanbanBoards: [KanbanBoard]\n    $footerLayout: DsbFooterLayout\n    $headerLayout: DsbHeaderLayout\n    $topbarEnabled: Boolean\n    $topbarBg: RainbowColor\n    $topbarBgCustomColor: String\n    $tagLayout: DsbTagLayout\n    $inlineTagLayout: DsbInlineTagLayout\n    $avatarLayout: DsbAvatarLayout\n    $navActiveLayout: DsbNavActiveLayout\n    $broadcastEnable: Boolean\n    $kanbanBgColors: [RainbowColor]\n    $broadcastLayout: DsbBroadcastLayout\n    $broadcastBg: RainbowColor\n    $broadcastCustomBg: String\n    $broadcastArticleLayout: DsbBroadcastArticleLayout\n    $broadcastArticleBg: RainbowColor\n    $broadcastArticleCustomBg: String\n    $broadcastArticleEnable: Boolean\n    $overlayDark: Boolean\n    $brandLayout: DsbBrandLayout\n    $communityLayout: DsbCommunityLayout\n    $changelogLayout: DsbChangelogLayout\n    $docCoverLayout: DsbDocCoverLayout\n    $docFaqLayout: DsbDocFaqLayout\n  ) {\n    updateDashboardLayout(\n      community: $community\n      postLayout: $postLayout\n      kanbanLayout: $kanbanLayout\n      kanbanCardLayout: $kanbanCardLayout\n      kanbanBoards: $kanbanBoards\n      footerLayout: $footerLayout\n      headerLayout: $headerLayout\n      topbarEnabled: $topbarEnabled\n      topbarBg: $topbarBg\n      topbarBgCustomColor: $topbarBgCustomColor\n      tagLayout: $tagLayout\n      inlineTagLayout: $inlineTagLayout\n      avatarLayout: $avatarLayout\n      navActiveLayout: $navActiveLayout\n      broadcastEnable: $broadcastEnable\n      broadcastLayout: $broadcastLayout\n      broadcastBg: $broadcastBg\n      broadcastCustomBg: $broadcastCustomBg\n      broadcastArticleLayout: $broadcastArticleLayout\n      broadcastArticleBg: $broadcastArticleBg\n      broadcastArticleCustomBg: $broadcastArticleCustomBg\n      broadcastArticleEnable: $broadcastArticleEnable\n      kanbanBgColors: $kanbanBgColors\n      overlayDark: $overlayDark\n      brandLayout: $brandLayout\n      communityLayout: $communityLayout\n      changelogLayout: $changelogLayout\n      docCoverLayout: $docCoverLayout\n      docFaqLayout: $docFaqLayout\n    ) {\n      layout {\n        postLayout\n        kanbanLayout\n        kanbanCardLayout\n        kanbanBoards\n        kanbanBgColors\n        docCoverLayout\n        docFaqLayout\n        tagLayout\n        inlineTagLayout\n        avatarLayout\n        brandLayout\n        communityLayout\n        navActiveLayout\n        topbarEnabled\n        topbarBg\n        topbarBgCustomColor\n        broadcastLayout\n        broadcastBg\n        broadcastCustomBg\n        broadcastEnable\n        broadcastArticleLayout\n        broadcastArticleBg\n        broadcastArticleCustomBg\n        broadcastArticleEnable\n        changelogLayout\n        footerLayout\n        headerLayout\n        overlayDark\n      }\n    }\n  }\n':
    types.UpdateDashboardLayoutDocument,
  '\n  mutation CreateCommunityAssetUploadIntent(\n    $community: String!\n    $file: CommunityAssetUploadFileInput!\n  ) {\n    createCommunityAssetUploadIntent(community: $community, file: $file) {\n      uploadRef\n      assetPublicRef\n      objectKey\n      capability\n      expiresAt\n      maxSizeBytes\n      allowedMimeTypes\n    }\n  }\n':
    types.CreateCommunityAssetUploadIntentDocument,
  '\n  query PagedCommunityAssets($community: String!, $filter: CommunityAssetFilter) {\n    pagedCommunityAssets(community: $community, filter: $filter) {\n      entries {\n        id\n        publicRef\n        thread\n        assetType\n        status\n        filename\n        mimeType\n        sizeBytes\n        storage\n        storageKey\n        contentHash\n        width\n        height\n        url\n        uploader {\n          login\n          nickname\n        }\n        deletedAt\n        insertedAt\n      }\n      pageNumber\n      pageSize\n      totalCount\n      totalPages\n    }\n  }\n':
    types.PagedCommunityAssetsDocument,
  '\n  query CommunityAssetStats($community: String!, $filter: CommunityAssetFilter) {\n    communityAssetStats(community: $community, filter: $filter) {\n      totalCount\n      storageBytes\n      storageLimitBytes\n      byThread {\n        thread\n        count\n      }\n      byAssetType {\n        assetType\n        count\n        subtypes {\n          key\n          label\n          count\n        }\n      }\n    }\n  }\n':
    types.CommunityAssetStatsDocument,
  '\n  query CommunityAssetRefs($community: String!, $assetId: ID!, $filter: PagiFilter) {\n    communityAssetRefs(community: $community, assetId: $assetId, filter: $filter) {\n      entries {\n        id\n        thread\n        articleId\n        usage\n        blockId\n        blockType\n        position\n        title\n        alt\n        source\n        insertedAt\n      }\n      pageNumber\n      pageSize\n      totalCount\n      totalPages\n    }\n  }\n':
    types.CommunityAssetRefsDocument,
  '\n  mutation DeleteCommunityAsset($community: String!, $id: ID!) {\n    deleteCommunityAsset(community: $community, id: $id) {\n      id\n      publicRef\n      status\n      deletedAt\n    }\n  }\n':
    types.DeleteCommunityAssetDocument,
  '\n  query DashboardTrashedPosts($community: String!, $page: Int!, $size: Int!) {\n    trashedArticles(community: $community, thread: POST, filter: { page: $page, size: $size }) {\n      entries {\n        id\n        thread\n        articleRef\n        deletedAt\n        scheduledPermanentDeletionAt\n        mentionedByCount\n        deletedBy {\n          ...DashboardAuthorFields\n        }\n        article {\n          innerId\n          title\n          views\n          upvotesCount\n          meta {\n            thread\n          }\n          ... on Post {\n            cat\n            status\n            commentsCount\n            insertedAt\n            activeAt\n            author {\n              ...DashboardAuthorFields\n            }\n            communityTags {\n              ...DashboardTagFields\n            }\n          }\n        }\n      }\n      ...DashboardTrashedArticlesPageInfo\n    }\n  }\n':
    types.DashboardTrashedPostsDocument,
  '\n  mutation restoreTrashedPost($community: String!, $id: ID!) {\n    restoreTrashedArticle(community: $community, id: $id, thread: POST) {\n      innerId\n      title\n    }\n  }\n':
    types.RestoreTrashedPostDocument,
  '\n  mutation permanentlyDeleteTrashedPost($community: String!, $id: ID!) {\n    permanentlyDeleteTrashedArticle(community: $community, id: $id, thread: POST) {\n      done\n    }\n  }\n':
    types.PermanentlyDeleteTrashedPostDocument,
  '\n  fragment DashboardDocTreeNodeFields on DocTreeNode {\n    id\n    parentNodeId\n    docId\n    type\n    title\n    index\n    href\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n      appearance {\n        light {\n          color\n          bg\n        }\n        dark {\n          color\n          bg\n        }\n      }\n    }\n    badge\n    hidden\n    publishState {\n      status\n      published\n      publishedBefore\n      hasDraft\n      publicNodeId\n      publicDocId\n      hasUnpublishedChanges\n      lastPublishedAt\n      inCover\n      hiddenFromCover\n      pinnedToCover\n    }\n  }\n':
    types.DashboardDocTreeNodeFieldsFragmentDoc,
  '\n  fragment DashboardDocTreeChildFields on DocTreeNode {\n    ...DashboardDocTreeNodeFields\n    pages {\n      ...DashboardDocTreeNodeFields\n    }\n  }\n':
    types.DashboardDocTreeChildFieldsFragmentDoc,
  '\n  fragment DashboardDocTreeGroupFields on DocTreeNode {\n    ...DashboardDocTreeNodeFields\n    pages {\n      ...DashboardDocTreeChildFields\n    }\n  }\n':
    types.DashboardDocTreeGroupFieldsFragmentDoc,
  '\n  fragment DashboardDocPublishChecklistItemFields on DocPublishChecklistItem {\n    id\n    title\n    action\n    selectedByDefault\n    selectable\n    disabledReason\n  }\n':
    types.DashboardDocPublishChecklistItemFieldsFragmentDoc,
  '\n  fragment DashboardDocTreeMutationPayload on DocTreeMutationPayload {\n    revision\n    treeState {\n      hasUnpublishedChanges\n      stagedEventCount\n      baseSnapshotId\n      latestSnapshotId\n      latestReleaseId\n      latestReleaseNumber\n      revision\n    }\n    conflict\n    node {\n      ...DashboardDocTreeNodeFields\n    }\n    affectedNodes {\n      ...DashboardDocTreeNodeFields\n    }\n  }\n':
    types.DashboardDocTreeMutationPayloadFragmentDoc,
  '\n  query DashboardDocTree($community: String!) {\n    docTree(community: $community) {\n      revision\n      treeState {\n        hasUnpublishedChanges\n        stagedEventCount\n        baseSnapshotId\n        latestSnapshotId\n        latestReleaseId\n        latestReleaseNumber\n        revision\n      }\n      stagedEvents {\n        id\n        seq\n        eventType\n        payload\n        inversePayload\n        status\n        insertedAt\n      }\n      tabs {\n        ...DashboardDocTreeNodeFields\n        pins {\n          ...DashboardDocTreeNodeFields\n        }\n        groups {\n          ...DashboardDocTreeGroupFields\n        }\n      }\n    }\n  }\n':
    types.DashboardDocTreeDocument,
  '\n  query DashboardDocPublishChecklist($community: String!) {\n    docPublishChecklist(community: $community) {\n      totalCount\n      docChanges {\n        ...DashboardDocPublishChecklistItemFields\n      }\n      treeChanges {\n        ...DashboardDocPublishChecklistItemFields\n      }\n    }\n  }\n':
    types.DashboardDocPublishChecklistDocument,
  '\n  query docTreeTrashItems($community: String!) {\n    docTreeTrashItems(community: $community) {\n      id\n      nodeId\n      docId\n      type\n      title\n      deletedFromParentNodeId\n      deletedFromIndex\n      deletedAt\n      restoredAt\n    }\n  }\n':
    types.DocTreeTrashItemsDocument,
  '\n  query docDraft($community: String!, $id: ID!) {\n    docDraft(community: $community, id: $id) {\n      id\n      docId\n      title\n      subtitle\n      slug\n      stage\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n':
    types.DocDraftDocument,
  '\n  query docDraftSnapshots($community: String!, $id: ID!, $stage: DocSnapshotStage) {\n    docDraftSnapshots(community: $community, id: $id, stage: $stage) {\n      id\n      thread\n      stage\n      action\n      articleHashId\n      title\n      slug\n      subtitle\n      digest\n      documentJson\n      versionHash\n      revisionNumber\n      schemaVersion\n      insertedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n':
    types.DocDraftSnapshotsDocument,
  '\n  mutation CreateDocTreeNode(\n    $community: String!\n    $baseRevision: Int!\n    $parentNodeId: ID\n    $input: DocTreeNodeInput!\n  ) {\n    createDocTreeNode(\n      community: $community\n      baseRevision: $baseRevision\n      parentNodeId: $parentNodeId\n      input: $input\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n':
    types.CreateDocTreeNodeDocument,
  '\n  mutation UpdateDocTreeNode(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $patch: DocTreeNodePatchInput!\n  ) {\n    updateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision, patch: $patch) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n':
    types.UpdateDocTreeNodeDocument,
  '\n  mutation UpdateDocDraft(\n    $community: String!\n    $id: ID!\n    $expectedVersion: Int!\n    $title: String\n    $subtitle: String\n    $slug: String\n    $bodyBag: ArtimentBodyBagInput\n  ) {\n    updateDocDraft(\n      community: $community\n      id: $id\n      expectedVersion: $expectedVersion\n      title: $title\n      subtitle: $subtitle\n      slug: $slug\n      bodyBag: $bodyBag\n    ) {\n      id\n      docId\n      title\n      subtitle\n      slug\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n':
    types.UpdateDocDraftDocument,
  '\n  mutation checkpointDocDraftSnapshot($community: String!, $id: ID!) {\n    checkpointDocDraftSnapshot(community: $community, id: $id) {\n      id\n      thread\n      stage\n      action\n      articleHashId\n      title\n      slug\n      subtitle\n      documentJson\n      digest\n      versionHash\n      revisionNumber\n      schemaVersion\n      insertedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n':
    types.CheckpointDocDraftSnapshotDocument,
  '\n  mutation publishDocChanges(\n    $community: String!\n    $input: DocPublishChangesInput\n    $mode: DocPublishMode\n  ) {\n    publishDocChanges(community: $community, input: $input, mode: $mode) {\n      done\n      release {\n        id\n        releaseNumber\n        publishedAt\n      }\n      checklist {\n        totalCount\n        docChanges {\n          ...DashboardDocPublishChecklistItemFields\n        }\n        treeChanges {\n          ...DashboardDocPublishChecklistItemFields\n        }\n      }\n    }\n  }\n':
    types.PublishDocChangesDocument,
  '\n  mutation moveDocToDraft($community: String!, $id: ID!) {\n    moveDocToDraft(community: $community, id: $id) {\n      docId\n      stage\n      publishState {\n        status\n        published\n        publishedBefore\n        hasDraft\n        publicNodeId\n        publicDocId\n        hasUnpublishedChanges\n        lastPublishedAt\n        inCover\n        hiddenFromCover\n        pinnedToCover\n      }\n    }\n  }\n':
    types.MoveDocToDraftDocument,
  '\n  mutation moveDocTreeSubtreeToDraft($community: String!, $nodeId: ID!) {\n    moveDocTreeSubtreeToDraft(community: $community, nodeId: $nodeId) {\n      done\n    }\n  }\n':
    types.MoveDocTreeSubtreeToDraftDocument,
  '\n  mutation restoreDocDraftSnapshot($community: String!, $id: ID!, $snapshotId: ID!) {\n    restoreDocDraftSnapshot(community: $community, id: $id, snapshotId: $snapshotId) {\n      id\n      title\n      subtitle\n      slug\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n':
    types.RestoreDocDraftSnapshotDocument,
  '\n  mutation DeleteDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {\n    deleteDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n':
    types.DeleteDocTreeNodeDocument,
  '\n  mutation RestoreDocTreeTrashItem(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $targetParentNodeId: ID\n    $targetIndex: Int\n  ) {\n    restoreDocTreeTrashItem(\n      community: $community\n      id: $id\n      baseRevision: $baseRevision\n      targetParentNodeId: $targetParentNodeId\n      targetIndex: $targetIndex\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n':
    types.RestoreDocTreeTrashItemDocument,
  '\n  mutation DuplicateDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {\n    duplicateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n':
    types.DuplicateDocTreeNodeDocument,
  '\n  mutation MoveDocTreeNode(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $targetParentNodeId: ID\n    $targetIndex: Int\n  ) {\n    moveDocTreeNode(\n      community: $community\n      id: $id\n      baseRevision: $baseRevision\n      targetParentNodeId: $targetParentNodeId\n      targetIndex: $targetIndex\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n':
    types.MoveDocTreeNodeDocument,
  '\n  mutation addDocCoverCard($community: String!, $groupNodeId: ID!) {\n    addDocCoverCard(community: $community, groupNodeId: $groupNodeId) {\n      id\n      index\n      appearance\n    }\n  }\n':
    types.AddDocCoverCardDocument,
  '\n  mutation removeDocCoverCard($community: String!, $groupNodeId: ID!) {\n    removeDocCoverCard(community: $community, groupNodeId: $groupNodeId) {\n      id\n      index\n      appearance\n    }\n  }\n':
    types.RemoveDocCoverCardDocument,
  '\n  mutation reorderDocCoverCards($community: String!, $ids: [ID!]!) {\n    reorderDocCoverCards(community: $community, ids: $ids) {\n      done\n    }\n  }\n':
    types.ReorderDocCoverCardsDocument,
  '\n  mutation pinDocToCover($community: String!, $nodeId: ID!) {\n    pinDocToCover(community: $community, nodeId: $nodeId) {\n      nodeId\n      index\n      appearance\n    }\n  }\n':
    types.PinDocToCoverDocument,
  '\n  mutation unpinDocFromCover($community: String!, $nodeId: ID!) {\n    unpinDocFromCover(community: $community, nodeId: $nodeId) {\n      nodeId\n    }\n  }\n':
    types.UnpinDocFromCoverDocument,
  '\n  mutation reorderDocCoverPinnedDocs($community: String!, $nodeIds: [ID!]!) {\n    reorderDocCoverPinnedDocs(community: $community, nodeIds: $nodeIds) {\n      done\n    }\n  }\n':
    types.ReorderDocCoverPinnedDocsDocument,
  '\n  mutation updateDocCoverCardAppearance($community: String!, $id: ID!, $appearance: Json!) {\n    updateDocCoverCardAppearance(community: $community, id: $id, appearance: $appearance) {\n      id\n      appearance\n    }\n  }\n':
    types.UpdateDocCoverCardAppearanceDocument,
  '\n  mutation updatePinnedDocAppearance($community: String!, $nodeId: ID!, $appearance: Json!) {\n    updatePinnedDocAppearance(community: $community, nodeId: $nodeId, appearance: $appearance) {\n      nodeId\n      appearance\n    }\n  }\n':
    types.UpdatePinnedDocAppearanceDocument,
  '\n  fragment DashboardAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n':
    types.DashboardAuthorFieldsFragmentDoc,
  '\n  fragment DashboardTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n':
    types.DashboardTagFieldsFragmentDoc,
  '\n  fragment DashboardThirdPartyAnalyticsFields on DsbThirdPartyAnalytics {\n    provider\n    enabled\n    measurementId\n    containerId\n    projectId\n    domain\n    siteId\n  }\n':
    types.DashboardThirdPartyAnalyticsFieldsFragmentDoc,
  '\n  fragment DashboardHeaderLinkFields on DsbLink {\n    id\n    type\n    title\n    url\n    links {\n      id\n      title\n      url\n    }\n  }\n':
    types.DashboardHeaderLinkFieldsFragmentDoc,
  '\n  fragment DashboardFooterOnelineLinkFields on DsbLinkChild {\n    id\n    title\n    url\n  }\n':
    types.DashboardFooterOnelineLinkFieldsFragmentDoc,
  '\n  fragment DashboardTrashedArticlesPageInfo on PagedTrashedArticles {\n    totalCount\n    pageSize\n    totalPages\n    pageNumber\n  }\n':
    types.DashboardTrashedArticlesPageInfoFragmentDoc,
  '\n  query DashboardPressConfig($community: String!) {\n    pressConfig(community: $community) {\n      markdownEnabled\n      feedEnabled\n      feedType\n      feedCount\n      feedThreads\n      llmsEnabled\n      sitemapEnabled\n      revision\n    }\n  }\n':
    types.DashboardPressConfigDocument,
  '\n  mutation UpdateDashboardPressConfig($input: UpdatePressConfigInput!) {\n    updatePressConfig(input: $input) {\n      config {\n        markdownEnabled\n        feedEnabled\n        feedType\n        feedCount\n        feedThreads\n        llmsEnabled\n        sitemapEnabled\n        revision\n      }\n    }\n  }\n':
    types.UpdateDashboardPressConfigDocument,
  '\n  query DashboardThirdPartyAnalyticsProviders {\n    thirdPartyAnalyticsProviders {\n      provider\n      title\n      desc\n      detail\n      docsUrl\n      icon\n      identityField\n      configFields {\n        key\n        label\n        desc\n        placeholder\n        requiredWhenEnabled\n        pattern\n      }\n    }\n  }\n':
    types.DashboardThirdPartyAnalyticsProvidersDocument,
  '\n  query DashboardOpenGraphInfo($url: String!) {\n    openGraphInfo(url: $url) {\n      title\n      favicon\n      url\n      siteName\n    }\n  }\n':
    types.DashboardOpenGraphInfoDocument,
  '\n  mutation UpdateDashboardBaseInfo(\n    $community: String!\n    $homepage: String\n    $title: String\n    $slug: String\n    $desc: String\n    $locale: String\n    $introduction: String\n    $logo: String\n    $favicon: String\n    $city: String\n    $techstack: String\n  ) {\n    updateDashboardBaseInfo(\n      community: $community\n      homepage: $homepage\n      title: $title\n      slug: $slug\n      desc: $desc\n      locale: $locale\n      introduction: $introduction\n      logo: $logo\n      favicon: $favicon\n      city: $city\n      techstack: $techstack\n    ) {\n      baseInfo {\n        title\n        logo\n        favicon\n        locale\n      }\n    }\n  }\n':
    types.UpdateDashboardBaseInfoDocument,
  '\n  mutation UpdateDashboardMediaReports($community: String!, $mediaReports: [DsbMediaReportMap]) {\n    updateDashboardMediaReports(community: $community, mediaReports: $mediaReports) {\n      mediaReports {\n        index\n        title\n        url\n        favicon\n        siteName\n      }\n    }\n  }\n':
    types.UpdateDashboardMediaReportsDocument,
  '\n  mutation UpdateDashboardThirdPartyAnalytics(\n    $community: String!\n    $thirdPartyAnalytics: [DsbThirdPartyAnalyticsInput]\n  ) {\n    updateDashboardThirdPartyAnalytics(\n      community: $community\n      thirdPartyAnalytics: $thirdPartyAnalytics\n    ) {\n      thirdPartyAnalytics {\n        ...DashboardThirdPartyAnalyticsFields\n      }\n    }\n  }\n':
    types.UpdateDashboardThirdPartyAnalyticsDocument,
  '\n  mutation UpdateDashboardSeo(\n    $community: String!\n    $seoEnable: Boolean\n    $ogSiteName: String\n    $ogTitle: String\n    $ogDescription: String\n    $ogUrl: String\n    $ogImage: String\n    $ogLocale: String\n    $ogPublisher: String\n    $twTitle: String\n    $twDescription: String\n    $twUrl: String\n    $twCard: String\n    $twSite: String\n    $twImage: String\n    $twImageWidth: String\n    $twImageHeight: String\n  ) {\n    updateDashboardSeo(\n      community: $community\n      seoEnable: $seoEnable\n      ogSiteName: $ogSiteName\n      ogTitle: $ogTitle\n      ogDescription: $ogDescription\n      ogUrl: $ogUrl\n      ogImage: $ogImage\n      ogLocale: $ogLocale\n      ogPublisher: $ogPublisher\n      twTitle: $twTitle\n      twDescription: $twDescription\n      twUrl: $twUrl\n      twCard: $twCard\n      twSite: $twSite\n      twImage: $twImage\n      twImageWidth: $twImageWidth\n      twImageHeight: $twImageHeight\n    ) {\n      seo {\n        seoEnable\n      }\n    }\n  }\n':
    types.UpdateDashboardSeoDocument,
  '\n  mutation UpdateDashboardEnable(\n    $community: String!\n    $post: Boolean\n    $blog: Boolean\n    $kanban: Boolean\n    $changelog: Boolean\n    $doc: Boolean\n    $docLastUpdate: Boolean\n    $docReaction: Boolean\n    $about: Boolean\n    $aboutTechstack: Boolean\n    $aboutLocation: Boolean\n    $aboutLinks: Boolean\n    $aboutMediaReport: Boolean\n    $visitorLocationMap: Boolean\n  ) {\n    updateDashboardEnable(\n      community: $community\n      post: $post\n      blog: $blog\n      kanban: $kanban\n      changelog: $changelog\n      doc: $doc\n      docLastUpdate: $docLastUpdate\n      docReaction: $docReaction\n      about: $about\n      aboutTechstack: $aboutTechstack\n      aboutLocation: $aboutLocation\n      aboutLinks: $aboutLinks\n      aboutMediaReport: $aboutMediaReport\n      visitorLocationMap: $visitorLocationMap\n    ) {\n      enable {\n        post\n        blog\n        kanban\n        changelog\n        doc\n        docLastUpdate\n        docReaction\n        about\n        aboutTechstack\n        aboutLocation\n        aboutLinks\n        aboutMediaReport\n        visitorLocationMap\n      }\n    }\n  }\n':
    types.UpdateDashboardEnableDocument,
  '\n  mutation UpdateDashboardSocialLinks($community: String!, $socialLinks: [DsbSocialLinkMap]) {\n    updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {\n      socialLinks {\n        type\n        link\n      }\n    }\n  }\n':
    types.UpdateDashboardSocialLinksDocument,
  '\n  mutation UpdateDashboardNameAlias($community: String!, $nameAlias: [DsbAliasMap]) {\n    updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {\n      nameAlias {\n        original\n        name\n        slug\n        group\n      }\n    }\n  }\n':
    types.UpdateDashboardNameAliasDocument,
  '\n  mutation UpdateDashboardDocFaq($community: String!, $docFaq: DsbDocFaqInput!) {\n    updateDashboardDocFaq(community: $community, docFaq: $docFaq) {\n      docFaq {\n        title\n        desc\n        groupedView\n        groupItems {\n          id\n          title\n          index\n          items {\n            id\n            title\n            detail\n            index\n          }\n        }\n        flatItems {\n          id\n          title\n          detail\n          index\n        }\n      }\n    }\n  }\n':
    types.UpdateDashboardDocFaqDocument,
  '\n  mutation UpdateDashboardHeaderLinks($community: String!, $headerLinks: [DsbLinkMap]) {\n    updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {\n      headerLinks {\n        ...DashboardHeaderLinkFields\n      }\n    }\n  }\n':
    types.UpdateDashboardHeaderLinksDocument,
  '\n  mutation UpdateDashboardFooterLinks($community: String!, $footerLinks: [DsbLinkMap]) {\n    updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {\n      footerLinks {\n        ...DashboardHeaderLinkFields\n      }\n    }\n  }\n':
    types.UpdateDashboardFooterLinksDocument,
  '\n  mutation UpdateDashboardFooterOnelineLinks(\n    $community: String!\n    $footerOnelineLinks: [DsbLinkChildMap]\n  ) {\n    updateDashboardFooterOnelineLinks(\n      community: $community\n      footerOnelineLinks: $footerOnelineLinks\n    ) {\n      footerOnelineLinks {\n        ...DashboardFooterOnelineLinkFields\n      }\n    }\n  }\n':
    types.UpdateDashboardFooterOnelineLinksDocument,
  '\n  query DashboardCommunityBaseInfo($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      dashboard {\n        baseInfo {\n          title\n          locale\n          favicon\n          logo\n          slug\n          desc\n          introduction\n          homepage\n          city\n          techstack\n        }\n        mediaReports {\n          url\n          title\n          siteName\n          favicon\n          index\n        }\n      }\n    }\n  }\n':
    types.DashboardCommunityBaseInfoDocument,
  '\n  query DashboardCommunitySocialLinks($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      dashboard {\n        socialLinks {\n          type\n          link\n        }\n      }\n    }\n  }\n':
    types.DashboardCommunitySocialLinksDocument,
  '\n  query DashboardCommunityOverview($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      views\n      subscribersCount\n      meta {\n        postsCount\n        changelogsCount\n        docsCount\n      }\n    }\n  }\n':
    types.DashboardCommunityOverviewDocument,
  '\n  query DashboardCommunityTagGroups($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n':
    types.DashboardCommunityTagGroupsDocument,
  '\n  mutation DashboardUpdateCommunityTag(\n    $id: ID!\n    $color: RainbowColor\n    $title: String\n    $slug: String\n    $community: String!\n    $extra: [String]\n    $marker: MarkerInput\n    $groupId: ID\n  ) {\n    updateCommunityTag(\n      id: $id\n      color: $color\n      title: $title\n      slug: $slug\n      community: $community\n      extra: $extra\n      marker: $marker\n      groupId: $groupId\n    ) {\n      id\n      title\n      slug\n      color\n      groupId\n      extra\n      marker {\n        type\n        provider\n        name\n        src\n        unified\n      }\n    }\n  }\n':
    types.DashboardUpdateCommunityTagDocument,
  '\n  mutation DashboardCreateCommunityTagGroup(\n    $thread: Thread!\n    $title: String!\n    $community: String!\n  ) {\n    createCommunityTagGroup(thread: $thread, title: $title, community: $community) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n':
    types.DashboardCreateCommunityTagGroupDocument,
  '\n  mutation DashboardUpdateCommunityTagGroup(\n    $id: ID!\n    $title: String!\n    $community: String!\n    $thread: Thread\n  ) {\n    updateCommunityTagGroup(id: $id, title: $title, community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n':
    types.DashboardUpdateCommunityTagGroupDocument,
  '\n  mutation DashboardCreateCommunityTag(\n    $thread: Thread!\n    $title: String!\n    $slug: String!\n    $layout: String\n    $color: RainbowColor!\n    $groupId: ID!\n    $community: String!\n    $marker: MarkerInput\n  ) {\n    createCommunityTag(\n      thread: $thread\n      title: $title\n      slug: $slug\n      layout: $layout\n      color: $color\n      groupId: $groupId\n      community: $community\n      marker: $marker\n    ) {\n      id\n    }\n  }\n':
    types.DashboardCreateCommunityTagDocument,
  '\n  mutation DashboardReindexTagsInGroup(\n    $community: String!\n    $thread: Thread\n    $groupId: ID!\n    $tags: [ReindexTagInput]\n  ) {\n    reindexTagsInGroup(community: $community, thread: $thread, groupId: $groupId, tags: $tags) {\n      done\n    }\n  }\n':
    types.DashboardReindexTagsInGroupDocument,
  '\n  mutation DashboardReindexCommunityTags(\n    $community: String!\n    $thread: Thread\n    $tags: [ReindexCommunityTagInput]\n  ) {\n    reindexCommunityTags(community: $community, thread: $thread, tags: $tags) {\n      done\n    }\n  }\n':
    types.DashboardReindexCommunityTagsDocument,
  '\n  mutation DashboardReindexCommunityTagGroups(\n    $community: String!\n    $thread: Thread\n    $groups: [ReindexCommunityTagGroupInput]\n  ) {\n    reindexCommunityTagGroups(community: $community, thread: $thread, groups: $groups) {\n      done\n    }\n  }\n':
    types.DashboardReindexCommunityTagGroupsDocument,
  '\n  fragment KanbanAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n':
    types.KanbanAuthorFieldsFragmentDoc,
  '\n  fragment KanbanPageFields on PagedPosts {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n':
    types.KanbanPageFieldsFragmentDoc,
  '\n  query GroupedKanbanPosts($community: String!) {\n    groupedKanbanPosts(community: $community) {\n      backlog {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      todo {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      wip {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      done {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      rejected {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n    }\n  }\n':
    types.GroupedKanbanPostsDocument,
  '\n  query UserPassport($login: String!) {\n    user(login: $login) {\n      passportString\n      social {\n        github\n        twitter\n        zhihu\n      }\n    }\n  }\n':
    types.UserPassportDocument,
  '\n  query AllPassportRules {\n    allPassportRulesString {\n      cms\n    }\n  }\n':
    types.AllPassportRulesDocument,
  '\n  mutation UpdateModeratorPassport($community: String!, $user: String!, $rules: Json!) {\n    updateModeratorPassport(community: $community, user: $user, rules: $rules) {\n      slug\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n':
    types.UpdateModeratorPassportDocument,
  '\n  mutation RemoveModerator($community: String!, $user: String!) {\n    removeModerator(community: $community, user: $user) {\n      slug\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n':
    types.RemoveModeratorDocument,
  '\n    query PostThreadFresh($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n      post(article: $article) {\n        innerId\n        views\n        upvotesCount\n        commentsCount\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n    }\n  ':
    types.PostThreadFreshDocument,
  '\n  query RichEditorSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n':
    types.RichEditorSimpleQueryDocument,
  '\n  mutation DeleteCommunityTag($id: ID!, $community: String!, $thread: Thread) {\n    deleteCommunityTag(id: $id, community: $community, thread: $thread) {\n      id\n    }\n  }\n':
    types.DeleteCommunityTagDocument,
  '\n  mutation CreateCommunityTag(\n    $thread: Thread!\n    $title: String!\n    $slug: String!\n    $layout: String\n    $color: RainbowColor!\n    $groupId: ID!\n    $community: String!\n    $marker: MarkerInput\n  ) {\n    createCommunityTag(\n      thread: $thread\n      title: $title\n      slug: $slug\n      layout: $layout\n      color: $color\n      groupId: $groupId\n      community: $community\n      marker: $marker\n    ) {\n      id\n    }\n  }\n':
    types.CreateCommunityTagDocument,
  '\n  mutation UpdateCommunityTag(\n    $id: ID!\n    $color: RainbowColor\n    $title: String\n    $layout: String\n    $desc: String\n    $slug: String\n    $community: String!\n    $groupId: ID\n    $marker: MarkerInput\n  ) {\n    updateCommunityTag(\n      id: $id\n      color: $color\n      title: $title\n      desc: $desc\n      layout: $layout\n      slug: $slug\n      community: $community\n      groupId: $groupId\n      marker: $marker\n    ) {\n      id\n    }\n  }\n':
    types.UpdateCommunityTagDocument,
}

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation QueryUpvotePost($article: ArticlePathInput!) {\n    upvotePost(article: $article) {\n      innerId\n      upvotesCount\n      ... on Post {\n        viewerHasUpvoted\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation QueryUpvotePost($article: ArticlePathInput!) {\n    upvotePost(article: $article) {\n      innerId\n      upvotesCount\n      ... on Post {\n        viewerHasUpvoted\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation QueryUndoUpvotePost($article: ArticlePathInput!) {\n    undoUpvotePost(article: $article) {\n      innerId\n      upvotesCount\n      ... on Post {\n        viewerHasUpvoted\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation QueryUndoUpvotePost($article: ArticlePathInput!) {\n    undoUpvotePost(article: $article) {\n      innerId\n      upvotesCount\n      ... on Post {\n        viewerHasUpvoted\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation QueryUpvoteChangelog($article: ArticlePathInput!) {\n    upvoteChangelog(article: $article) {\n      innerId\n      upvotesCount\n      ... on Changelog {\n        viewerHasUpvoted\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation QueryUpvoteChangelog($article: ArticlePathInput!) {\n    upvoteChangelog(article: $article) {\n      innerId\n      upvotesCount\n      ... on Changelog {\n        viewerHasUpvoted\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!) {\n    undoUpvoteChangelog(article: $article) {\n      innerId\n      upvotesCount\n      ... on Changelog {\n        viewerHasUpvoted\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!) {\n    undoUpvoteChangelog(article: $article) {\n      innerId\n      upvotesCount\n      ... on Changelog {\n        viewerHasUpvoted\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation QueryUpvoteDoc($article: ArticlePathInput!) {\n    upvoteDoc(article: $article) {\n      innerId\n      upvotesCount\n      ... on Doc {\n        viewerHasUpvoted\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation QueryUpvoteDoc($article: ArticlePathInput!) {\n    upvoteDoc(article: $article) {\n      innerId\n      upvotesCount\n      ... on Doc {\n        viewerHasUpvoted\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!) {\n    undoUpvoteDoc(article: $article) {\n      innerId\n      upvotesCount\n      ... on Doc {\n        viewerHasUpvoted\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!) {\n    undoUpvoteDoc(article: $article) {\n      innerId\n      upvotesCount\n      ... on Doc {\n        viewerHasUpvoted\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ViewerArticleStates($filter: PagedPostsFilter!) {\n    pagedPosts(filter: $filter) {\n      entries {\n        innerId\n        community {\n          slug\n        }\n        meta {\n          thread\n        }\n        viewerHasViewed\n        viewerHasUpvoted\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ViewerArticleStates($filter: PagedPostsFilter!) {\n    pagedPosts(filter: $filter) {\n      entries {\n        innerId\n        community {\n          slug\n        }\n        meta {\n          thread\n        }\n        viewerHasViewed\n        viewerHasUpvoted\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ViewerChangelogStates($filter: PagedChangelogsFilter!) {\n    pagedChangelogs(filter: $filter) {\n      entries {\n        innerId\n        community {\n          slug\n        }\n        meta {\n          thread\n        }\n        viewerHasViewed\n        viewerHasUpvoted\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ViewerChangelogStates($filter: PagedChangelogsFilter!) {\n    pagedChangelogs(filter: $filter) {\n      entries {\n        innerId\n        community {\n          slug\n        }\n        meta {\n          thread\n        }\n        viewerHasViewed\n        viewerHasUpvoted\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PostViewerState($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n',
): (typeof documents)['\n  query PostViewerState($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ChangelogViewerState($article: ArticlePathInput!) {\n    changelog(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n',
): (typeof documents)['\n  query ChangelogViewerState($article: ArticlePathInput!) {\n    changelog(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DocViewerState($article: ArticlePathInput!) {\n    doc(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n',
): (typeof documents)['\n  query DocViewerState($article: ArticlePathInput!) {\n    doc(article: $article) {\n      innerId\n      viewerHasCollected\n      viewerHasUpvoted\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation SetCommunityTag($article: ArticlePathInput!, $tagId: ID!) {\n    setCommunityTag(article: $article, communityTagId: $tagId) {\n      innerId\n      title\n    }\n  }\n',
): (typeof documents)['\n  mutation SetCommunityTag($article: ArticlePathInput!, $tagId: ID!) {\n    setCommunityTag(article: $article, communityTagId: $tagId) {\n      innerId\n      title\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UnsetCommunityTag($article: ArticlePathInput!, $tagId: ID!) {\n    unsetCommunityTag(article: $article, communityTagId: $tagId) {\n      innerId\n      title\n    }\n  }\n',
): (typeof documents)['\n  mutation UnsetCommunityTag($article: ArticlePathInput!, $tagId: ID!) {\n    unsetCommunityTag(article: $article, communityTagId: $tagId) {\n      innerId\n      title\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation Follow($login: String!) {\n    follow(login: $login) {\n      login\n      viewerHasFollowed\n    }\n  }\n',
): (typeof documents)['\n  mutation Follow($login: String!) {\n    follow(login: $login) {\n      login\n      viewerHasFollowed\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UndoFollow($login: String!) {\n    undoFollow(login: $login) {\n      login\n      viewerHasFollowed\n    }\n  }\n',
): (typeof documents)['\n  mutation UndoFollow($login: String!) {\n    undoFollow(login: $login) {\n      login\n      viewerHasFollowed\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommunityActivityConfig($community: String!) {\n    communityActivityConfig(community: $community) {\n      resources {\n        resourceType\n        actions {\n          action\n          messageKey\n          category\n          highRisk\n        }\n      }\n      sources\n      actorTypes\n      presets {\n        key\n        questionKey\n        descriptionKey\n        coverageNoteKey\n        defaultTimeRange {\n          amount\n          unit\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query CommunityActivityConfig($community: String!) {\n    communityActivityConfig(community: $community) {\n      resources {\n        resourceType\n        actions {\n          action\n          messageKey\n          category\n          highRisk\n        }\n      }\n      sources\n      actorTypes\n      presets {\n        key\n        questionKey\n        descriptionKey\n        coverageNoteKey\n        defaultTimeRange {\n          amount\n          unit\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ExportCommunityActivity(\n    $community: String!\n    $selection: CommunityActivitySelectionInput!\n    $format: CommunityActivityExportFormat!\n  ) {\n    exportCommunityActivity(community: $community, selection: $selection, format: $format) {\n      content\n      filename\n      mimeType\n      totalCount\n      exportedCount\n      manifest\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation ExportCommunityActivity(\n    $community: String!\n    $selection: CommunityActivitySelectionInput!\n    $format: CommunityActivityExportFormat!\n  ) {\n    exportCommunityActivity(community: $community, selection: $selection, format: $format) {\n      content\n      filename\n      mimeType\n      totalCount\n      exportedCount\n      manifest\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommunityActivityEvent($community: String!, $eventRef: ID!) {\n    communityActivityEvent(community: $community, eventRef: $eventRef) {\n      id\n      eventRef\n      operationRef\n      parentEventRef\n      operationIndex\n      recordSequence\n      messageKey\n      action\n      category\n      highRisk\n      outcome\n      denialCode\n      changedFields\n      resource {\n        type\n        ref\n        title\n        innerId\n      }\n      actor {\n        type\n        id\n        login\n        nickname\n        avatar\n      }\n      onBehalfOf {\n        type\n        id\n        login\n        nickname\n        avatar\n      }\n      subject {\n        type\n        ref\n        title\n        innerId\n      }\n      target {\n        type\n        ref\n        title\n        innerId\n      }\n      source\n      payload\n      metadata\n      occurredAt\n      recordedAt\n      parentEvent {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n      childEvents {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n    }\n  }\n',
): (typeof documents)['\n  query CommunityActivityEvent($community: String!, $eventRef: ID!) {\n    communityActivityEvent(community: $community, eventRef: $eventRef) {\n      id\n      eventRef\n      operationRef\n      parentEventRef\n      operationIndex\n      recordSequence\n      messageKey\n      action\n      category\n      highRisk\n      outcome\n      denialCode\n      changedFields\n      resource {\n        type\n        ref\n        title\n        innerId\n      }\n      actor {\n        type\n        id\n        login\n        nickname\n        avatar\n      }\n      onBehalfOf {\n        type\n        id\n        login\n        nickname\n        avatar\n      }\n      subject {\n        type\n        ref\n        title\n        innerId\n      }\n      target {\n        type\n        ref\n        title\n        innerId\n      }\n      source\n      payload\n      metadata\n      occurredAt\n      recordedAt\n      parentEvent {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n      childEvents {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommunityActivity(\n    $community: String!\n    $selection: CommunityActivitySelectionInput!\n    $page: Int = 1\n  ) {\n    communityActivity(community: $community, selection: $selection, page: $page) {\n      entries {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        onBehalfOf {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n      totalCount\n      totalPages\n      pageNumber\n      pageSize\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n',
): (typeof documents)['\n  query CommunityActivity(\n    $community: String!\n    $selection: CommunityActivitySelectionInput!\n    $page: Int = 1\n  ) {\n    communityActivity(community: $community, selection: $selection, page: $page) {\n      entries {\n        id\n        eventRef\n        operationRef\n        parentEventRef\n        operationIndex\n        recordSequence\n        messageKey\n        action\n        category\n        highRisk\n        outcome\n        denialCode\n        changedFields\n        resource {\n          type\n          ref\n          title\n          innerId\n        }\n        actor {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        onBehalfOf {\n          type\n          id\n          login\n          nickname\n          avatar\n        }\n        subject {\n          type\n          ref\n          title\n          innerId\n        }\n        target {\n          type\n          ref\n          title\n          innerId\n        }\n        source\n        payload\n        metadata\n        occurredAt\n        recordedAt\n      }\n      totalCount\n      totalPages\n      pageNumber\n      pageSize\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommunityActivityStats($community: String!, $selection: CommunityActivitySelectionInput!) {\n    communityActivityStats(community: $community, selection: $selection) {\n      granularity\n      timezone\n      totalCount\n      buckets {\n        startedAt\n        endedAt\n        count\n      }\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n',
): (typeof documents)['\n  query CommunityActivityStats($community: String!, $selection: CommunityActivitySelectionInput!) {\n    communityActivityStats(community: $community, selection: $selection) {\n      granularity\n      timezone\n      totalCount\n      buckets {\n        startedAt\n        endedAt\n        count\n      }\n      queryContext {\n        preset {\n          key\n          questionKey\n        }\n        appliedFilter\n        coverage\n        presetIntersectionEmpty\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n',
): (typeof documents)['\n  fragment PageAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageCommonUserFields on CommonUser {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n',
): (typeof documents)['\n  fragment PageCommonUserFields on CommonUser {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageCommunityFields on Community {\n    title\n    slug\n    index\n    desc\n    logo\n    subscribersCount\n    homepage\n    articlesCount\n    views\n    pending\n    insertedAt\n    updatedAt\n  }\n',
): (typeof documents)['\n  fragment PageCommunityFields on Community {\n    title\n    slug\n    index\n    desc\n    logo\n    subscribersCount\n    homepage\n    articlesCount\n    views\n    pending\n    insertedAt\n    updatedAt\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n',
): (typeof documents)['\n  fragment PageTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PagePostFields on Post {\n    innerId\n    version\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n',
): (typeof documents)['\n  fragment PagePostFields on Post {\n    innerId\n    version\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PagePostDetailFields on Post {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n',
): (typeof documents)['\n  fragment PagePostDetailFields on Post {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageChangelogFields on Changelog {\n    innerId\n    version\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n',
): (typeof documents)['\n  fragment PageChangelogFields on Changelog {\n    innerId\n    version\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageChangelogDetailFields on Changelog {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n',
): (typeof documents)['\n  fragment PageChangelogDetailFields on Changelog {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PagePostPageInfo on PagedPosts {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n',
): (typeof documents)['\n  fragment PagePostPageInfo on PagedPosts {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageChangelogPageInfo on PagedChangelogs {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n',
): (typeof documents)['\n  fragment PageChangelogPageInfo on PagedChangelogs {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageDocFields on Doc {\n    innerId\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n',
): (typeof documents)['\n  fragment PageDocFields on Doc {\n    innerId\n    isPinned\n    title\n    insertedAt\n    activeAt\n    updatedAt\n    views\n    commentsCount\n    upvotesCount\n    commentsParticipantsCount\n    author {\n      ...PageAuthorFields\n    }\n    community {\n      ...PageCommunityFields\n    }\n    communities {\n      ...PageCommunityFields\n    }\n    communityTags {\n      ...PageTagFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageDocDetailFields on Doc {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n',
): (typeof documents)['\n  fragment PageDocDetailFields on Doc {\n    meta {\n      thread\n      isEdited\n      latestUpvotedUsers {\n        ...PageCommonUserFields\n      }\n    }\n    document {\n      json\n      html\n      markdown\n      markdownToc\n    }\n    commentsParticipants {\n      ...PageAuthorFields\n    }\n    collectsCount\n    lifecycle {\n      state\n      archivedAt\n    }\n    viewerHasCollected @include(if: $userHasLogin)\n    viewerHasUpvoted @include(if: $userHasLogin)\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageDocPageInfo on PagedDocs {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n',
): (typeof documents)['\n  fragment PageDocPageInfo on PagedDocs {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageCommunityPageInfo on PagedCommunities {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n',
): (typeof documents)['\n  fragment PageCommunityPageInfo on PagedCommunities {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Changelog($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    changelog(article: $article) {\n      ...PageChangelogFields\n      ...PageChangelogDetailFields\n    }\n  }\n',
): (typeof documents)['\n  query Changelog($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    changelog(article: $article) {\n      ...PageChangelogFields\n      ...PageChangelogDetailFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagedChangelogs($filter: PagedChangelogsFilter!, $userHasLogin: Boolean!) {\n    pagedChangelogs(filter: $filter) {\n      entries {\n        ...PageChangelogFields\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        digest\n        linkAddr\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PageChangelogPageInfo\n    }\n  }\n',
): (typeof documents)['\n  query PagedChangelogs($filter: PagedChangelogsFilter!, $userHasLogin: Boolean!) {\n    pagedChangelogs(filter: $filter) {\n      entries {\n        ...PageChangelogFields\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        digest\n        linkAddr\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PageChangelogPageInfo\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PageSubscribedCommunities($login: String, $filter: PagiFilter!) {\n    subscribedCommunities(login: $login, filter: $filter) {\n      entries {\n        ...PageCommunityFields\n        contributesDigest\n      }\n      ...PageCommunityPageInfo\n    }\n  }\n',
): (typeof documents)['\n  query PageSubscribedCommunities($login: String, $filter: PagiFilter!) {\n    subscribedCommunities(login: $login, filter: $filter) {\n      entries {\n        ...PageCommunityFields\n        contributesDigest\n      }\n      ...PageCommunityPageInfo\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PageCommunity($slug: String!, $userHasLogin: Boolean!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      title\n      slug\n      index\n      desc\n      logo\n      subscribersCount\n      homepage\n      articlesCount\n      views\n      pending\n      insertedAt\n      updatedAt\n      viewerHasSubscribed @include(if: $userHasLogin)\n      contributesDigest\n      moderatorsCount\n      meta {\n        postsCount\n        blogsCount\n      }\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n      dashboard {\n        baseInfo {\n          title\n          slug\n          locale\n          favicon\n          homepage\n          logo\n          desc\n          city\n          techstack\n          introduction\n        }\n        mediaReports {\n          url\n          title\n          siteName\n          favicon\n          index\n        }\n        thirdPartyAnalytics {\n          provider\n          enabled\n          measurementId\n          containerId\n          projectId\n          domain\n          siteId\n        }\n        enabledThirdPartyAnalytics {\n          provider\n          enabled\n          measurementId\n          containerId\n          projectId\n          domain\n          siteId\n        }\n        umamiWebsiteId\n        docFaq {\n          title\n          desc\n          groupedView\n          groupItems {\n            id\n            title\n            index\n            items {\n              id\n              title\n              detail\n              index\n            }\n          }\n          flatItems {\n            id\n            title\n            detail\n            index\n          }\n        }\n        wallpaper {\n          light {\n            type\n            source\n            gradient\n            pattern\n            contentShadow\n            effect\n            texture\n          }\n          dark {\n            type\n            source\n            gradient\n            pattern\n            contentShadow\n            effect\n            texture\n          }\n        }\n        headerLinks {\n          id\n          type\n          title\n          url\n          links {\n            id\n            title\n            url\n          }\n        }\n        footerLinks {\n          id\n          type\n          title\n          url\n          links {\n            id\n            title\n            url\n          }\n        }\n        footerOnelineLinks {\n          id\n          title\n          url\n        }\n        socialLinks {\n          type\n          link\n        }\n        seo {\n          seoEnable\n          ogSiteName\n          ogTitle\n          ogDescription\n          ogUrl\n          ogImage\n          twTitle\n          twDescription\n          twUrl\n          twCard\n          twSite\n          twImage\n          twImageWidth\n          twImageHeight\n        }\n        nameAlias {\n          slug\n          name\n          original\n          group\n        }\n        layout {\n          themePreset\n          themePresetBase\n          themeTokens\n          themePresets {\n            value\n            tokens\n          }\n          postLayout\n          docCoverLayout\n          docFaqLayout\n          tagLayout\n          inlineTagLayout\n          avatarLayout\n          brandLayout\n          communityLayout\n          navActiveLayout\n          topbarEnabled\n          topbarBg\n          topbarBgCustomColor\n          broadcastLayout\n          broadcastBg\n          broadcastCustomBg\n          broadcastArticleBg\n          broadcastArticleCustomBg\n          kanbanLayout\n          kanbanCardLayout\n          kanbanBoards\n          kanbanBgColors\n          changelogLayout\n          headerLayout\n          footerLayout\n          overlayDark\n          broadcastEnable\n        }\n        enable {\n          post\n          kanban\n          changelog\n          doc\n          docLastUpdate\n          docReaction\n          about\n          aboutTechstack\n          aboutLocation\n          aboutLinks\n          aboutMediaReport\n          visitorLocationMap\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query PageCommunity($slug: String!, $userHasLogin: Boolean!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      title\n      slug\n      index\n      desc\n      logo\n      subscribersCount\n      homepage\n      articlesCount\n      views\n      pending\n      insertedAt\n      updatedAt\n      viewerHasSubscribed @include(if: $userHasLogin)\n      contributesDigest\n      moderatorsCount\n      meta {\n        postsCount\n        blogsCount\n      }\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n      dashboard {\n        baseInfo {\n          title\n          slug\n          locale\n          favicon\n          homepage\n          logo\n          desc\n          city\n          techstack\n          introduction\n        }\n        mediaReports {\n          url\n          title\n          siteName\n          favicon\n          index\n        }\n        thirdPartyAnalytics {\n          provider\n          enabled\n          measurementId\n          containerId\n          projectId\n          domain\n          siteId\n        }\n        enabledThirdPartyAnalytics {\n          provider\n          enabled\n          measurementId\n          containerId\n          projectId\n          domain\n          siteId\n        }\n        umamiWebsiteId\n        docFaq {\n          title\n          desc\n          groupedView\n          groupItems {\n            id\n            title\n            index\n            items {\n              id\n              title\n              detail\n              index\n            }\n          }\n          flatItems {\n            id\n            title\n            detail\n            index\n          }\n        }\n        wallpaper {\n          light {\n            type\n            source\n            gradient\n            pattern\n            contentShadow\n            effect\n            texture\n          }\n          dark {\n            type\n            source\n            gradient\n            pattern\n            contentShadow\n            effect\n            texture\n          }\n        }\n        headerLinks {\n          id\n          type\n          title\n          url\n          links {\n            id\n            title\n            url\n          }\n        }\n        footerLinks {\n          id\n          type\n          title\n          url\n          links {\n            id\n            title\n            url\n          }\n        }\n        footerOnelineLinks {\n          id\n          title\n          url\n        }\n        socialLinks {\n          type\n          link\n        }\n        seo {\n          seoEnable\n          ogSiteName\n          ogTitle\n          ogDescription\n          ogUrl\n          ogImage\n          twTitle\n          twDescription\n          twUrl\n          twCard\n          twSite\n          twImage\n          twImageWidth\n          twImageHeight\n        }\n        nameAlias {\n          slug\n          name\n          original\n          group\n        }\n        layout {\n          themePreset\n          themePresetBase\n          themeTokens\n          themePresets {\n            value\n            tokens\n          }\n          postLayout\n          docCoverLayout\n          docFaqLayout\n          tagLayout\n          inlineTagLayout\n          avatarLayout\n          brandLayout\n          communityLayout\n          navActiveLayout\n          topbarEnabled\n          topbarBg\n          topbarBgCustomColor\n          broadcastLayout\n          broadcastBg\n          broadcastCustomBg\n          broadcastArticleBg\n          broadcastArticleCustomBg\n          kanbanLayout\n          kanbanCardLayout\n          kanbanBoards\n          kanbanBgColors\n          changelogLayout\n          headerLayout\n          footerLayout\n          overlayDark\n          broadcastEnable\n        }\n        enable {\n          post\n          kanban\n          changelog\n          doc\n          docLastUpdate\n          docReaction\n          about\n          aboutTechstack\n          aboutLocation\n          aboutLinks\n          aboutMediaReport\n          visitorLocationMap\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagePagedCommunities($filter: CommunitiesFilter!, $userHasLogin: Boolean!) {\n    pagedCommunities(filter: $filter) {\n      entries {\n        ...PageCommunityFields\n        contributesDigest\n        viewerHasSubscribed @include(if: $userHasLogin)\n      }\n      ...PageCommunityPageInfo\n    }\n  }\n',
): (typeof documents)['\n  query PagePagedCommunities($filter: CommunitiesFilter!, $userHasLogin: Boolean!) {\n    pagedCommunities(filter: $filter) {\n      entries {\n        ...PageCommunityFields\n        contributesDigest\n        viewerHasSubscribed @include(if: $userHasLogin)\n      }\n      ...PageCommunityPageInfo\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageDocPublicTreeNodeFields on DocPublicTreeNode {\n    id\n    parentNodeId\n    docId\n    type\n    title\n    index\n    href\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n      appearance {\n        light {\n          color\n          bg\n        }\n        dark {\n          color\n          bg\n        }\n      }\n    }\n    badge\n  }\n',
): (typeof documents)['\n  fragment PageDocPublicTreeNodeFields on DocPublicTreeNode {\n    id\n    parentNodeId\n    docId\n    type\n    title\n    index\n    href\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n      appearance {\n        light {\n          color\n          bg\n        }\n        dark {\n          color\n          bg\n        }\n      }\n    }\n    badge\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageDocPublicTreeChildFields on DocPublicTreeNode {\n    ...PageDocPublicTreeNodeFields\n    pages {\n      ...PageDocPublicTreeNodeFields\n    }\n  }\n',
): (typeof documents)['\n  fragment PageDocPublicTreeChildFields on DocPublicTreeNode {\n    ...PageDocPublicTreeNodeFields\n    pages {\n      ...PageDocPublicTreeNodeFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageDocPublicTreeGroupFields on DocPublicTreeNode {\n    ...PageDocPublicTreeNodeFields\n    pages {\n      ...PageDocPublicTreeChildFields\n    }\n  }\n',
): (typeof documents)['\n  fragment PageDocPublicTreeGroupFields on DocPublicTreeNode {\n    ...PageDocPublicTreeNodeFields\n    pages {\n      ...PageDocPublicTreeChildFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PageDoc($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    doc(article: $article) {\n      ...PageDocFields\n      subtitle\n      ...PageDocDetailFields\n    }\n  }\n',
): (typeof documents)['\n  query PageDoc($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    doc(article: $article) {\n      ...PageDocFields\n      subtitle\n      ...PageDocDetailFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PageDocPublicTree($community: String!) {\n    docPublicTree(community: $community) {\n      tabs {\n        ...PageDocPublicTreeNodeFields\n        pins {\n          ...PageDocPublicTreeNodeFields\n        }\n        groups {\n          ...PageDocPublicTreeGroupFields\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query PageDocPublicTree($community: String!) {\n    docPublicTree(community: $community) {\n      tabs {\n        ...PageDocPublicTreeNodeFields\n        pins {\n          ...PageDocPublicTreeNodeFields\n        }\n        groups {\n          ...PageDocPublicTreeGroupFields\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagePagedDocs($filter: PagedDocsFilter!, $userHasLogin: Boolean!) {\n    pagedDocs(filter: $filter) {\n      entries {\n        ...PageDocFields\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PageDocPageInfo\n    }\n  }\n',
): (typeof documents)['\n  query PagePagedDocs($filter: PagedDocsFilter!, $userHasLogin: Boolean!) {\n    pagedDocs(filter: $filter) {\n      entries {\n        ...PageDocFields\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PageDocPageInfo\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment PageCategoryPageInfo on PagedCategories {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n',
): (typeof documents)['\n  fragment PageCategoryPageInfo on PagedCategories {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PageCommunityTagGroups($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...PageTagFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  query PageCommunityTagGroups($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...PageTagFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommunityTagStats($community: String!, $thread: Thread!, $slug: String!) {\n    communityTagStats(community: $community, thread: $thread, slug: $slug) {\n      contentsCount\n      todayContentsCount\n    }\n  }\n',
): (typeof documents)['\n  query CommunityTagStats($community: String!, $thread: Thread!, $slug: String!) {\n    communityTagStats(community: $community, thread: $thread, slug: $slug) {\n      contentsCount\n      todayContentsCount\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ThemePresets {\n    themePresets {\n      value\n      tokens\n    }\n  }\n',
): (typeof documents)['\n  query ThemePresets {\n    themePresets {\n      value\n      tokens\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagePagedCategories($filter: PagiFilter!) {\n    pagedCategories(filter: $filter) {\n      entries {\n        id\n        title\n        slug\n        index\n      }\n      ...PageCategoryPageInfo\n    }\n  }\n',
): (typeof documents)['\n  query PagePagedCategories($filter: PagiFilter!) {\n    pagedCategories(filter: $filter) {\n      entries {\n        id\n        title\n        slug\n        index\n      }\n      ...PageCategoryPageInfo\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Post($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    post(article: $article) {\n      ...PagePostFields\n      ...PagePostDetailFields\n    }\n  }\n',
): (typeof documents)['\n  query Post($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n    post(article: $article) {\n      ...PagePostFields\n      ...PagePostDetailFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagedPosts($filter: PagedPostsFilter!, $userHasLogin: Boolean!) {\n    pagedPosts(filter: $filter) {\n      entries {\n        ...PagePostFields\n        cat\n        status\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        digest\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PagePostPageInfo\n    }\n  }\n',
): (typeof documents)['\n  query PagedPosts($filter: PagedPostsFilter!, $userHasLogin: Boolean!) {\n    pagedPosts(filter: $filter) {\n      entries {\n        ...PagePostFields\n        cat\n        status\n        meta {\n          thread\n          latestUpvotedUsers {\n            ...PageCommonUserFields\n          }\n        }\n        digest\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PagePostPageInfo\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagedPublishedPosts($login: String!, $filter: PagiFilter!, $userHasLogin: Boolean!) {\n    pagedPublishedPosts(login: $login, filter: $filter) {\n      entries {\n        ...PagePostFields\n        meta {\n          thread\n        }\n        digest\n        linkAddr\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PagePostPageInfo\n    }\n  }\n',
): (typeof documents)['\n  query PagedPublishedPosts($login: String!, $filter: PagiFilter!, $userHasLogin: Boolean!) {\n    pagedPublishedPosts(login: $login, filter: $filter) {\n      entries {\n        ...PagePostFields\n        meta {\n          thread\n        }\n        digest\n        linkAddr\n        commentsParticipants {\n          ...PageAuthorFields\n        }\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n      ...PagePostPageInfo\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagesGroupedKanbanPosts($community: String!) {\n    groupedKanbanPosts(community: $community) {\n      backlog {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      todo {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      wip {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      done {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      rejected {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n    }\n  }\n',
): (typeof documents)['\n  query PagesGroupedKanbanPosts($community: String!) {\n    groupedKanbanPosts(community: $community) {\n      backlog {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      todo {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      wip {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      done {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n      rejected {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...PageAuthorFields\n          }\n        }\n        ...PagePostPageInfo\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment UserAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n',
): (typeof documents)['\n  fragment UserAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment UserSocialFields on SocialMap {\n    github\n    twitter\n    company\n    blog\n  }\n',
): (typeof documents)['\n  fragment UserSocialFields on SocialMap {\n    github\n    twitter\n    company\n    blog\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment UserAchievementFields on Achievement {\n    reputation\n    articlesUpvotesCount\n    articlesCollectsCount\n  }\n',
): (typeof documents)['\n  fragment UserAchievementFields on Achievement {\n    reputation\n    articlesUpvotesCount\n    articlesCollectsCount\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Me {\n    me {\n      login\n      nickname\n      avatar\n      bio\n      passport\n    }\n  }\n',
): (typeof documents)['\n  query Me {\n    me {\n      login\n      nickname\n      avatar\n      bio\n      passport\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query User($login: String!, $userHasLogin: Boolean!) {\n    user(login: $login) {\n      ...UserAuthorFields\n      views\n      sex\n      location\n      social {\n        ...UserSocialFields\n      }\n      meta {\n        isMaker\n        publishedPostsCount\n        publishedBlogsCount\n      }\n      followersCount\n      followingsCount\n      viewerHasFollowed @include(if: $userHasLogin)\n      achievement {\n        ...UserAchievementFields\n      }\n      contributes {\n        records {\n          count\n          date\n        }\n        startDate\n        endDate\n        totalCount\n      }\n\n      subscribedCommunitiesCount\n\n      insertedAt\n    }\n  }\n',
): (typeof documents)['\n  query User($login: String!, $userHasLogin: Boolean!) {\n    user(login: $login) {\n      ...UserAuthorFields\n      views\n      sex\n      location\n      social {\n        ...UserSocialFields\n      }\n      meta {\n        isMaker\n        publishedPostsCount\n        publishedBlogsCount\n      }\n      followersCount\n      followingsCount\n      viewerHasFollowed @include(if: $userHasLogin)\n      achievement {\n        ...UserAchievementFields\n      }\n      contributes {\n        records {\n          count\n          date\n        }\n        startDate\n        endDate\n        totalCount\n      }\n\n      subscribedCommunitiesCount\n\n      insertedAt\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query SessionState {\n    sessionState {\n      isValid\n      user {\n        ...UserAuthorFields\n        geoCity\n        location\n        social {\n          ...UserSocialFields\n        }\n        passport\n        subscribedCommunitiesCount\n        achievement {\n          ...UserAchievementFields\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query SessionState {\n    sessionState {\n      isValid\n      user {\n        ...UserAuthorFields\n        geoCity\n        location\n        social {\n          ...UserSocialFields\n        }\n        passport\n        subscribedCommunitiesCount\n        achievement {\n          ...UserAchievementFields\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AboutSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n',
): (typeof documents)['\n  query AboutSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment ArticleEditorAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n',
): (typeof documents)['\n  fragment ArticleEditorAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment ArticleEditorCommunityFields on Community {\n    title\n    slug\n    index\n    desc\n    logo\n    subscribersCount\n    homepage\n    articlesCount\n    views\n    pending\n    insertedAt\n    updatedAt\n  }\n',
): (typeof documents)['\n  fragment ArticleEditorCommunityFields on Community {\n    title\n    slug\n    index\n    desc\n    logo\n    subscribersCount\n    homepage\n    articlesCount\n    views\n    pending\n    insertedAt\n    updatedAt\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment ArticleEditorTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n',
): (typeof documents)['\n  fragment ArticleEditorTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreatePost(\n    $title: String!\n    $bodyBag: ArtimentBodyBagInput!\n    $community: String!\n    $communityTags: [ID]\n    $linkAddr: String\n    $copyRight: String\n  ) {\n    createPost(\n      title: $title\n      bodyBag: $bodyBag\n      community: $community\n      communityTags: $communityTags\n      linkAddr: $linkAddr\n      copyRight: $copyRight\n    ) {\n      innerId\n      title\n      meta {\n        thread\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation CreatePost(\n    $title: String!\n    $bodyBag: ArtimentBodyBagInput!\n    $community: String!\n    $communityTags: [ID]\n    $linkAddr: String\n    $copyRight: String\n  ) {\n    createPost(\n      title: $title\n      bodyBag: $bodyBag\n      community: $community\n      communityTags: $communityTags\n      linkAddr: $linkAddr\n      copyRight: $copyRight\n    ) {\n      innerId\n      title\n      meta {\n        thread\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdatePostFromEditor(\n    $article: ArticlePathInput!\n    $expectedVersion: Int!\n    $title: String\n    $bodyBag: ArtimentBodyBagInput\n    $linkAddr: String\n    $copyRight: String\n    $communityTags: [ID]\n  ) {\n    updatePost(\n      article: $article\n      expectedVersion: $expectedVersion\n      title: $title\n      bodyBag: $bodyBag\n      linkAddr: $linkAddr\n      copyRight: $copyRight\n      communityTags: $communityTags\n    ) {\n      innerId\n      title\n      author {\n        ...ArticleEditorAuthorFields\n      }\n      meta {\n        thread\n        isLegal\n        illegalReason\n        illegalWords\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdatePostFromEditor(\n    $article: ArticlePathInput!\n    $expectedVersion: Int!\n    $title: String\n    $bodyBag: ArtimentBodyBagInput\n    $linkAddr: String\n    $copyRight: String\n    $communityTags: [ID]\n  ) {\n    updatePost(\n      article: $article\n      expectedVersion: $expectedVersion\n      title: $title\n      bodyBag: $bodyBag\n      linkAddr: $linkAddr\n      copyRight: $copyRight\n      communityTags: $communityTags\n    ) {\n      innerId\n      title\n      author {\n        ...ArticleEditorAuthorFields\n      }\n      meta {\n        thread\n        isLegal\n        illegalReason\n        illegalWords\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ArticleEditorCommunity($slug: String!) {\n    community(slug: $slug) {\n      logo\n      title\n      slug\n      desc\n      subscribersCount\n    }\n  }\n',
): (typeof documents)['\n  query ArticleEditorCommunity($slug: String!) {\n    community(slug: $slug) {\n      logo\n      title\n      slug\n      desc\n      subscribersCount\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ArticleEditorPost($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n      version\n      title\n      linkAddr\n      copyRight\n      lifecycle {\n        state\n        archivedAt\n      }\n      author {\n        ...ArticleEditorAuthorFields\n      }\n      community {\n        ...ArticleEditorCommunityFields\n      }\n      communityTags {\n        ...ArticleEditorTagFields\n      }\n      meta {\n        thread\n        isLegal\n        illegalReason\n        illegalWords\n      }\n      document {\n        json\n      }\n    }\n  }\n',
): (typeof documents)['\n  query ArticleEditorPost($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n      version\n      title\n      linkAddr\n      copyRight\n      lifecycle {\n        state\n        archivedAt\n      }\n      author {\n        ...ArticleEditorAuthorFields\n      }\n      community {\n        ...ArticleEditorCommunityFields\n      }\n      communityTags {\n        ...ArticleEditorTagFields\n      }\n      meta {\n        thread\n        isLegal\n        illegalReason\n        illegalWords\n      }\n      document {\n        json\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment ArticleMenuTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n',
): (typeof documents)['\n  fragment ArticleMenuTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdatePostFromMenu(\n    $article: ArticlePathInput!\n    $expectedVersion: Int!\n    $title: String\n    $communityTags: [ID]\n  ) {\n    updatePost(\n      article: $article\n      expectedVersion: $expectedVersion\n      title: $title\n      communityTags: $communityTags\n    ) {\n      innerId\n      title\n      communityTags {\n        ...ArticleMenuTagFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdatePostFromMenu(\n    $article: ArticlePathInput!\n    $expectedVersion: Int!\n    $title: String\n    $communityTags: [ID]\n  ) {\n    updatePost(\n      article: $article\n      expectedVersion: $expectedVersion\n      title: $title\n      communityTags: $communityTags\n    ) {\n      innerId\n      title\n      communityTags {\n        ...ArticleMenuTagFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation SetPostCat($article: ArticlePathInput!, $cat: ArticleCatEnum!) {\n    setPostCat(article: $article, cat: $cat) {\n      innerId\n      cat\n    }\n  }\n',
): (typeof documents)['\n  mutation SetPostCat($article: ArticlePathInput!, $cat: ArticleCatEnum!) {\n    setPostCat(article: $article, cat: $cat) {\n      innerId\n      cat\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation SetPostStatus($article: ArticlePathInput!, $status: ArticleStatusEnum!) {\n    setPostStatus(article: $article, status: $status) {\n      innerId\n      status\n    }\n  }\n',
): (typeof documents)['\n  mutation SetPostStatus($article: ArticlePathInput!, $status: ArticleStatusEnum!) {\n    setPostStatus(article: $article, status: $status) {\n      innerId\n      status\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation PinPost($article: ArticlePathInput!) {\n    pinPost(article: $article) {\n      innerId\n    }\n  }\n',
): (typeof documents)['\n  mutation PinPost($article: ArticlePathInput!) {\n    pinPost(article: $article) {\n      innerId\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UndoPinPost($article: ArticlePathInput!) {\n    undoPinPost(article: $article) {\n      innerId\n      isPinned\n    }\n  }\n',
): (typeof documents)['\n  mutation UndoPinPost($article: ArticlePathInput!) {\n    undoPinPost(article: $article) {\n      innerId\n      isPinned\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommunityTagGroupsForMenu($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...ArticleMenuTagFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  query CommunityTagGroupsForMenu($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...ArticleMenuTagFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ChangelogSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n',
): (typeof documents)['\n  query ChangelogSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n',
): (typeof documents)['\n  fragment CommentAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentEmotionFields on EmotionStat {\n    type\n    count\n    viewerHasReacted\n    latestUsers {\n      login\n      nickname\n      avatar\n    }\n  }\n',
): (typeof documents)['\n  fragment CommentEmotionFields on EmotionStat {\n    type\n    count\n    viewerHasReacted\n    latestUsers {\n      login\n      nickname\n      avatar\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentMetaFields on CommentMeta {\n    isLegal\n    illegalReason\n    illegalWords\n    isArticleAuthorUpvoted\n    isReplyToOthers\n  }\n',
): (typeof documents)['\n  fragment CommentMetaFields on CommentMeta {\n    isLegal\n    illegalReason\n    illegalWords\n    isArticleAuthorUpvoted\n    isReplyToOthers\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentFields on Comment {\n    innerId\n    bodyHtml\n    author {\n      ...CommentAuthorFields\n    }\n    meta {\n      ...CommentMetaFields\n    }\n    emotions {\n      ...CommentEmotionFields\n    }\n    isPinned\n    isSolution\n    floor\n    upvotesCount\n    isArticleAuthor\n    viewerHasUpvoted\n    viewerHasReported\n    repliesCount\n    insertedAt\n    updatedAt\n  }\n',
): (typeof documents)['\n  fragment CommentFields on Comment {\n    innerId\n    bodyHtml\n    author {\n      ...CommentAuthorFields\n    }\n    meta {\n      ...CommentMetaFields\n    }\n    emotions {\n      ...CommentEmotionFields\n    }\n    isPinned\n    isSolution\n    floor\n    upvotesCount\n    isArticleAuthor\n    viewerHasUpvoted\n    viewerHasReported\n    repliesCount\n    insertedAt\n    updatedAt\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentReplyFields on CommentReply {\n    innerId\n    bodyHtml\n    author {\n      ...CommentAuthorFields\n    }\n    meta {\n      ...CommentMetaFields\n    }\n    emotions {\n      ...CommentEmotionFields\n    }\n    isPinned\n    isSolution\n    floor\n    upvotesCount\n    isArticleAuthor\n    viewerHasUpvoted\n    viewerHasReported\n    repliesCount\n    insertedAt\n    updatedAt\n    replyToComment {\n      ...CommentFields\n    }\n  }\n',
): (typeof documents)['\n  fragment CommentReplyFields on CommentReply {\n    innerId\n    bodyHtml\n    author {\n      ...CommentAuthorFields\n    }\n    meta {\n      ...CommentMetaFields\n    }\n    emotions {\n      ...CommentEmotionFields\n    }\n    isPinned\n    isSolution\n    floor\n    upvotesCount\n    isArticleAuthor\n    viewerHasUpvoted\n    viewerHasReported\n    repliesCount\n    insertedAt\n    updatedAt\n    replyToComment {\n      ...CommentFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment CommentPageFields on PagedComments {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n',
): (typeof documents)['\n  fragment CommentPageFields on PagedComments {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagedComments($article: ArticlePathInput!, $mode: CommentsMode, $filter: CommentsFilter!) {\n    pagedComments(article: $article, mode: $mode, filter: $filter) {\n      entries {\n        ...CommentFields\n        replyToComment {\n          ...CommentFields\n        }\n        replies {\n          ...CommentReplyFields\n        }\n      }\n      ...CommentPageFields\n    }\n  }\n',
): (typeof documents)['\n  query PagedComments($article: ArticlePathInput!, $mode: CommentsMode, $filter: CommentsFilter!) {\n    pagedComments(article: $article, mode: $mode, filter: $filter) {\n      entries {\n        ...CommentFields\n        replyToComment {\n          ...CommentFields\n        }\n        replies {\n          ...CommentReplyFields\n        }\n      }\n      ...CommentPageFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagedCommentReplies($comment: CommentPathInput!, $filter: CommentsFilter!) {\n    pagedCommentReplies(comment: $comment, filter: $filter) {\n      entries {\n        ...CommentReplyFields\n      }\n      totalPages\n      totalCount\n      pageSize\n      pageNumber\n    }\n  }\n',
): (typeof documents)['\n  query PagedCommentReplies($comment: CommentPathInput!, $filter: CommentsFilter!) {\n    pagedCommentReplies(comment: $comment, filter: $filter) {\n      entries {\n        ...CommentReplyFields\n      }\n      totalPages\n      totalCount\n      pageSize\n      pageNumber\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateComment($article: ArticlePathInput!, $body: String!) {\n    createComment(article: $article, body: $body) {\n      comment {\n        ...CommentFields\n      }\n      article {\n        innerId\n        commentsCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateComment($article: ArticlePathInput!, $body: String!) {\n    createComment(article: $article, body: $body) {\n      comment {\n        ...CommentFields\n      }\n      article {\n        innerId\n        commentsCount\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateComment($comment: CommentPathInput!, $body: String!) {\n    updateComment(comment: $comment, body: $body) {\n      innerId\n      bodyHtml\n      replyToComment {\n        innerId\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateComment($comment: CommentPathInput!, $body: String!) {\n    updateComment(comment: $comment, body: $body) {\n      innerId\n      bodyHtml\n      replyToComment {\n        innerId\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommentsState($article: ArticlePathInput!, $freshkey: String) {\n    commentsState(article: $article, freshkey: $freshkey) {\n      totalCount\n      isViewerJoined\n      participantsCount\n      participants {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n',
): (typeof documents)['\n  query CommentsState($article: ArticlePathInput!, $freshkey: String) {\n    commentsState(article: $article, freshkey: $freshkey) {\n      totalCount\n      isViewerJoined\n      participantsCount\n      participants {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query OneComment($comment: CommentPathInput!) {\n    oneComment(comment: $comment) {\n      innerId\n      body\n    }\n  }\n',
): (typeof documents)['\n  query OneComment($comment: CommentPathInput!) {\n    oneComment(comment: $comment) {\n      innerId\n      body\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ReplyComment($comment: CommentPathInput!, $body: String!) {\n    replyComment(comment: $comment, body: $body) {\n      comment {\n        ...CommentFields\n        replyToComment {\n          ...CommentFields\n        }\n      }\n      article {\n        innerId\n        commentsCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation ReplyComment($comment: CommentPathInput!, $body: String!) {\n    replyComment(comment: $comment, body: $body) {\n      comment {\n        ...CommentFields\n        replyToComment {\n          ...CommentFields\n        }\n      }\n      article {\n        innerId\n        commentsCount\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteComment($comment: CommentPathInput!) {\n    deleteComment(comment: $comment) {\n      innerId\n    }\n  }\n',
): (typeof documents)['\n  mutation DeleteComment($comment: CommentPathInput!) {\n    deleteComment(comment: $comment) {\n      innerId\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpvoteComment($comment: CommentPathInput!) {\n    upvoteComment(comment: $comment) {\n      innerId\n      meta {\n        isArticleAuthorUpvoted\n      }\n      upvotesCount\n      viewerHasUpvoted\n      replyToComment {\n        innerId\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpvoteComment($comment: CommentPathInput!) {\n    upvoteComment(comment: $comment) {\n      innerId\n      meta {\n        isArticleAuthorUpvoted\n      }\n      upvotesCount\n      viewerHasUpvoted\n      replyToComment {\n        innerId\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UndoUpvoteComment($comment: CommentPathInput!) {\n    undoUpvoteComment(comment: $comment) {\n      innerId\n      meta {\n        isArticleAuthorUpvoted\n      }\n      upvotesCount\n      viewerHasUpvoted\n      replyToComment {\n        innerId\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UndoUpvoteComment($comment: CommentPathInput!) {\n    undoUpvoteComment(comment: $comment) {\n      innerId\n      meta {\n        isArticleAuthorUpvoted\n      }\n      upvotesCount\n      viewerHasUpvoted\n      replyToComment {\n        innerId\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ReportComment($comment: CommentPathInput!, $reason: String!, $attr: String) {\n    reportComment(comment: $comment, reason: $reason, attr: $attr) {\n      innerId\n      viewerHasReported\n      meta {\n        reportedCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation ReportComment($comment: CommentPathInput!, $reason: String!, $attr: String) {\n    reportComment(comment: $comment, reason: $reason, attr: $attr) {\n      innerId\n      viewerHasReported\n      meta {\n        reportedCount\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UndoReportComment($comment: CommentPathInput!) {\n    undoReportComment(comment: $comment) {\n      innerId\n      viewerHasReported\n      meta {\n        reportedCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UndoReportComment($comment: CommentPathInput!) {\n    undoReportComment(comment: $comment) {\n      innerId\n      viewerHasReported\n      meta {\n        reportedCount\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation EmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {\n    emotionToComment(comment: $comment, emotion: $emotion) {\n      innerId\n      replyToComment {\n        innerId\n      }\n      emotions {\n        ...CommentEmotionFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation EmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {\n    emotionToComment(comment: $comment, emotion: $emotion) {\n      innerId\n      replyToComment {\n        innerId\n      }\n      emotions {\n        ...CommentEmotionFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UndoEmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {\n    undoEmotionToComment(comment: $comment, emotion: $emotion) {\n      innerId\n      replyToComment {\n        innerId\n      }\n      emotions {\n        ...CommentEmotionFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UndoEmotionToComment($comment: CommentPathInput!, $emotion: CommentEmotion!) {\n    undoEmotionToComment(comment: $comment, emotion: $emotion) {\n      innerId\n      replyToComment {\n        innerId\n      }\n      emotions {\n        ...CommentEmotionFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query SearchUsers($name: String!) {\n    searchUsers(name: $name) {\n      entries {\n        ...CommentAuthorFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  query SearchUsers($name: String!) {\n    searchUsers(name: $name) {\n      entries {\n        ...CommentAuthorFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagedPublishedComments($login: String!, $thread: Thread, $filter: PagiFilter!) {\n    pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {\n      entries {\n        ...CommentFields\n        article {\n          innerId\n          title\n          thread\n          author {\n            nickname\n            login\n          }\n        }\n      }\n      ...CommentPageFields\n    }\n  }\n',
): (typeof documents)['\n  query PagedPublishedComments($login: String!, $thread: Thread, $filter: PagiFilter!) {\n    pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {\n      entries {\n        ...CommentFields\n        article {\n          innerId\n          title\n          thread\n          author {\n            nickname\n            login\n          }\n        }\n      }\n      ...CommentPageFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CoverSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n',
): (typeof documents)['\n  query CoverSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DocCoverMarkerFields on Marker {\n    type\n    provider\n    name\n    src\n    unified\n    appearance {\n      light {\n        color\n        bg\n      }\n      dark {\n        color\n        bg\n      }\n    }\n  }\n',
): (typeof documents)['\n  fragment DocCoverMarkerFields on Marker {\n    type\n    provider\n    name\n    src\n    unified\n    appearance {\n      light {\n        color\n        bg\n      }\n      dark {\n        color\n        bg\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DocCoverItemFields on DocCoverCardItem {\n    id\n    nodeId\n    docId\n    index\n    type\n    title\n    href\n    badge\n    leafCount\n    marker {\n      ...DocCoverMarkerFields\n    }\n  }\n',
): (typeof documents)['\n  fragment DocCoverItemFields on DocCoverCardItem {\n    id\n    nodeId\n    docId\n    index\n    type\n    title\n    href\n    badge\n    leafCount\n    marker {\n      ...DocCoverMarkerFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DocCover($community: String!, $view: DocCoverView = PUBLIC) {\n    docCover(community: $community, view: $view) {\n      cards {\n        id\n        groupNodeId\n        index\n        appearance\n        title\n        items {\n          ...DocCoverItemFields\n        }\n      }\n      pinnedDocs {\n        nodeId\n        index\n        appearance\n        href\n        doc {\n          title\n          author {\n            avatar\n            nickname\n          }\n          document {\n            thumbnail\n          }\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DocCover($community: String!, $view: DocCoverView = PUBLIC) {\n    docCover(community: $community, view: $view) {\n      cards {\n        id\n        groupNodeId\n        index\n        appearance\n        title\n        items {\n          ...DocCoverItemFields\n        }\n      }\n      pinnedDocs {\n        nodeId\n        index\n        appearance\n        href\n        doc {\n          title\n          author {\n            avatar\n            nickname\n          }\n          document {\n            thumbnail\n          }\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AnalysisActiveVisitors($community: String!) {\n    analysisActiveVisitors(community: $community) {\n      visitors\n    }\n  }\n',
): (typeof documents)['\n  query AnalysisActiveVisitors($community: String!) {\n    analysisActiveVisitors(community: $community) {\n      visitors\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AnalysisTrendPages(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendPagesDimension!\n  ) {\n    analysisTrendPages(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n          bounceRate\n          visitDuration\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n',
): (typeof documents)['\n  query AnalysisTrendPages(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendPagesDimension!\n  ) {\n    analysisTrendPages(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n          bounceRate\n          visitDuration\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AnalysisTrendSources(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendSourcesDimension!\n  ) {\n    analysisTrendSources(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n',
): (typeof documents)['\n  query AnalysisTrendSources(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendSourcesDimension!\n  ) {\n    analysisTrendSources(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AnalysisTrendEnvironment(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendEnvironmentDimension!\n  ) {\n    analysisTrendEnvironment(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n          percentage\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n',
): (typeof documents)['\n  query AnalysisTrendEnvironment(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendEnvironmentDimension!\n  ) {\n    analysisTrendEnvironment(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        metrics {\n          visitors\n          visits\n          views\n          percentage\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AnalysisTrendLocation(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendLocationDimension!\n  ) {\n    analysisTrendLocation(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        code\n        metrics {\n          visitors\n          visits\n          views\n          percentage\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n',
): (typeof documents)['\n  query AnalysisTrendLocation(\n    $community: String!\n    $days: Int\n    $dimension: AnalysisTrendLocationDimension!\n  ) {\n    analysisTrendLocation(community: $community, days: $days, dimension: $dimension) {\n      status\n      items {\n        value\n        label\n        code\n        metrics {\n          visitors\n          visits\n          views\n          percentage\n        }\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AnalysisTrendTraffic($community: String!, $days: Int) {\n    analysisTrendTraffic(community: $community, days: $days) {\n      status\n      timezone\n      cells {\n        weekday\n        hour\n        visitors\n        visits\n        views\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n',
): (typeof documents)['\n  query AnalysisTrendTraffic($community: String!, $days: Int) {\n    analysisTrendTraffic(community: $community, days: $days) {\n      status\n      timezone\n      cells {\n        weekday\n        hour\n        visitors\n        visits\n        views\n      }\n      error {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AnalysisTrendsOverview($community: String!, $days: Int) {\n    analysisTrendsOverview(community: $community, days: $days) {\n      status\n      provider\n      range {\n        days\n        startAt\n        endAt\n        bucket\n      }\n      summary {\n        pageviews {\n          value\n          previousValue\n          changeRate\n        }\n        visitors {\n          value\n          previousValue\n          changeRate\n        }\n        visits {\n          value\n          previousValue\n          changeRate\n        }\n        bounceRate {\n          value\n          previousValue\n          changeRate\n        }\n        visitDuration {\n          value\n          previousValue\n          changeRate\n        }\n      }\n      chart {\n        bucket\n        points {\n          timestamp\n          visits\n          views\n        }\n      }\n      errors {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n',
): (typeof documents)['\n  query AnalysisTrendsOverview($community: String!, $days: Int) {\n    analysisTrendsOverview(community: $community, days: $days) {\n      status\n      provider\n      range {\n        days\n        startAt\n        endAt\n        bucket\n      }\n      summary {\n        pageviews {\n          value\n          previousValue\n          changeRate\n        }\n        visitors {\n          value\n          previousValue\n          changeRate\n        }\n        visits {\n          value\n          previousValue\n          changeRate\n        }\n        bounceRate {\n          value\n          previousValue\n          changeRate\n        }\n        visitDuration {\n          value\n          previousValue\n          changeRate\n        }\n      }\n      chart {\n        bucket\n        points {\n          timestamp\n          visits\n          views\n        }\n      }\n      errors {\n        code\n        message\n        section\n        providerStatus\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation SaveCustomThemePreset(\n    $community: String!\n    $themePreset: DsbThemePreset!\n    $themePresetBase: DsbThemePreset!\n    $themeOverwrite: Json\n  ) {\n    saveCustomThemePreset(\n      community: $community\n      themePreset: $themePreset\n      themePresetBase: $themePresetBase\n      themeOverwrite: $themeOverwrite\n    ) {\n      layout {\n        themePreset\n        themePresetBase\n        themeTokens\n        themePresets {\n          value\n          tokens\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation SaveCustomThemePreset(\n    $community: String!\n    $themePreset: DsbThemePreset!\n    $themePresetBase: DsbThemePreset!\n    $themeOverwrite: Json\n  ) {\n    saveCustomThemePreset(\n      community: $community\n      themePreset: $themePreset\n      themePresetBase: $themePresetBase\n      themeOverwrite: $themeOverwrite\n    ) {\n      layout {\n        themePreset\n        themePresetBase\n        themeTokens\n        themePresets {\n          value\n          tokens\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation SelectThemePreset($community: String!, $themePreset: DsbThemePreset!) {\n    selectThemePreset(community: $community, themePreset: $themePreset) {\n      layout {\n        themePreset\n        themePresetBase\n        themeTokens\n        themePresets {\n          value\n          tokens\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation SelectThemePreset($community: String!, $themePreset: DsbThemePreset!) {\n    selectThemePreset(community: $community, themePreset: $themePreset) {\n      layout {\n        themePreset\n        themePresetBase\n        themeTokens\n        themePresets {\n          value\n          tokens\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardWallpaperFields on DsbWallpaper {\n    light {\n      type\n      source\n      gradient\n      pattern\n      contentShadow\n      effect\n      texture\n    }\n    dark {\n      type\n      source\n      gradient\n      pattern\n      contentShadow\n      effect\n      texture\n    }\n  }\n',
): (typeof documents)['\n  fragment DashboardWallpaperFields on DsbWallpaper {\n    light {\n      type\n      source\n      gradient\n      pattern\n      contentShadow\n      effect\n      texture\n    }\n    dark {\n      type\n      source\n      gradient\n      pattern\n      contentShadow\n      effect\n      texture\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardWallpaper($community: String!, $wallpaper: DsbWallpaperInput!) {\n    updateDashboardWallpaper(community: $community, wallpaper: $wallpaper) {\n      wallpaper {\n        ...DashboardWallpaperFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardWallpaper($community: String!, $wallpaper: DsbWallpaperInput!) {\n    updateDashboardWallpaper(community: $community, wallpaper: $wallpaper) {\n      wallpaper {\n        ...DashboardWallpaperFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment ContentImportJobFields on ContentImportJob {\n    id\n    status\n    progress\n    process {\n      state\n      stage\n      progress {\n        completed\n        total\n        unit\n      }\n      recentBatch {\n        ref\n        label\n        state\n      }\n      updatedAt\n    }\n    errorCode\n    errorMessage\n    failedItems\n    skipped\n    targetBranch\n    firstImportedDocRef\n    sourceInfo {\n      repo\n      repoUrl\n      branch\n      commit\n      framework\n      contentRoot\n      configPaths\n    }\n    counts {\n      tabs\n      groups\n      pages\n      links\n      assets\n    }\n    tree\n    badSmells\n  }\n',
): (typeof documents)['\n  fragment ContentImportJobFields on ContentImportJob {\n    id\n    status\n    progress\n    process {\n      state\n      stage\n      progress {\n        completed\n        total\n        unit\n      }\n      recentBatch {\n        ref\n        label\n        state\n      }\n      updatedAt\n    }\n    errorCode\n    errorMessage\n    failedItems\n    skipped\n    targetBranch\n    firstImportedDocRef\n    sourceInfo {\n      repo\n      repoUrl\n      branch\n      commit\n      framework\n      contentRoot\n      configPaths\n    }\n    counts {\n      tabs\n      groups\n      pages\n      links\n      assets\n    }\n    tree\n    badSmells\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query ContentImportJob($community: String!, $jobRef: ID!) {\n    contentImportJob(community: $community, jobRef: $jobRef) {\n      ...ContentImportJobFields\n    }\n  }\n',
): (typeof documents)['\n  query ContentImportJob($community: String!, $jobRef: ID!) {\n    contentImportJob(community: $community, jobRef: $jobRef) {\n      ...ContentImportJobFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardCommunityModerators($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardCommunityModerators($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardUserPassport($login: String!) {\n    user(login: $login) {\n      passportString\n    }\n  }\n',
): (typeof documents)['\n  query DashboardUserPassport($login: String!) {\n    user(login: $login) {\n      passportString\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardSearchUsers($name: String!) {\n    searchUsers(name: $name) {\n      entries {\n        login\n        avatar\n        nickname\n        bio\n        social {\n          github\n          twitter\n          zhihu\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardSearchUsers($name: String!) {\n    searchUsers(name: $name) {\n      entries {\n        login\n        avatar\n        nickname\n        bio\n        social {\n          github\n          twitter\n          zhihu\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardAddModerator($community: String!, $user: String!) {\n    addModerator(community: $community, user: $user) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardAddModerator($community: String!, $user: String!) {\n    addModerator(community: $community, user: $user) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardAddModerators($community: String!, $users: [String!]!) {\n    addModerators(community: $community, users: $users) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardAddModerators($community: String!, $users: [String!]!) {\n    addModerators(community: $community, users: $users) {\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardLayout(\n    $community: String!\n    $postLayout: DsbPostLayout\n    $kanbanLayout: DsbKanbanLayout\n    $kanbanCardLayout: DsbKanbanCardLayout\n    $kanbanBoards: [KanbanBoard]\n    $footerLayout: DsbFooterLayout\n    $headerLayout: DsbHeaderLayout\n    $topbarEnabled: Boolean\n    $topbarBg: RainbowColor\n    $topbarBgCustomColor: String\n    $tagLayout: DsbTagLayout\n    $inlineTagLayout: DsbInlineTagLayout\n    $avatarLayout: DsbAvatarLayout\n    $navActiveLayout: DsbNavActiveLayout\n    $broadcastEnable: Boolean\n    $kanbanBgColors: [RainbowColor]\n    $broadcastLayout: DsbBroadcastLayout\n    $broadcastBg: RainbowColor\n    $broadcastCustomBg: String\n    $broadcastArticleLayout: DsbBroadcastArticleLayout\n    $broadcastArticleBg: RainbowColor\n    $broadcastArticleCustomBg: String\n    $broadcastArticleEnable: Boolean\n    $overlayDark: Boolean\n    $brandLayout: DsbBrandLayout\n    $communityLayout: DsbCommunityLayout\n    $changelogLayout: DsbChangelogLayout\n    $docCoverLayout: DsbDocCoverLayout\n    $docFaqLayout: DsbDocFaqLayout\n  ) {\n    updateDashboardLayout(\n      community: $community\n      postLayout: $postLayout\n      kanbanLayout: $kanbanLayout\n      kanbanCardLayout: $kanbanCardLayout\n      kanbanBoards: $kanbanBoards\n      footerLayout: $footerLayout\n      headerLayout: $headerLayout\n      topbarEnabled: $topbarEnabled\n      topbarBg: $topbarBg\n      topbarBgCustomColor: $topbarBgCustomColor\n      tagLayout: $tagLayout\n      inlineTagLayout: $inlineTagLayout\n      avatarLayout: $avatarLayout\n      navActiveLayout: $navActiveLayout\n      broadcastEnable: $broadcastEnable\n      broadcastLayout: $broadcastLayout\n      broadcastBg: $broadcastBg\n      broadcastCustomBg: $broadcastCustomBg\n      broadcastArticleLayout: $broadcastArticleLayout\n      broadcastArticleBg: $broadcastArticleBg\n      broadcastArticleCustomBg: $broadcastArticleCustomBg\n      broadcastArticleEnable: $broadcastArticleEnable\n      kanbanBgColors: $kanbanBgColors\n      overlayDark: $overlayDark\n      brandLayout: $brandLayout\n      communityLayout: $communityLayout\n      changelogLayout: $changelogLayout\n      docCoverLayout: $docCoverLayout\n      docFaqLayout: $docFaqLayout\n    ) {\n      layout {\n        postLayout\n        kanbanLayout\n        kanbanCardLayout\n        kanbanBoards\n        kanbanBgColors\n        docCoverLayout\n        docFaqLayout\n        tagLayout\n        inlineTagLayout\n        avatarLayout\n        brandLayout\n        communityLayout\n        navActiveLayout\n        topbarEnabled\n        topbarBg\n        topbarBgCustomColor\n        broadcastLayout\n        broadcastBg\n        broadcastCustomBg\n        broadcastEnable\n        broadcastArticleLayout\n        broadcastArticleBg\n        broadcastArticleCustomBg\n        broadcastArticleEnable\n        changelogLayout\n        footerLayout\n        headerLayout\n        overlayDark\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardLayout(\n    $community: String!\n    $postLayout: DsbPostLayout\n    $kanbanLayout: DsbKanbanLayout\n    $kanbanCardLayout: DsbKanbanCardLayout\n    $kanbanBoards: [KanbanBoard]\n    $footerLayout: DsbFooterLayout\n    $headerLayout: DsbHeaderLayout\n    $topbarEnabled: Boolean\n    $topbarBg: RainbowColor\n    $topbarBgCustomColor: String\n    $tagLayout: DsbTagLayout\n    $inlineTagLayout: DsbInlineTagLayout\n    $avatarLayout: DsbAvatarLayout\n    $navActiveLayout: DsbNavActiveLayout\n    $broadcastEnable: Boolean\n    $kanbanBgColors: [RainbowColor]\n    $broadcastLayout: DsbBroadcastLayout\n    $broadcastBg: RainbowColor\n    $broadcastCustomBg: String\n    $broadcastArticleLayout: DsbBroadcastArticleLayout\n    $broadcastArticleBg: RainbowColor\n    $broadcastArticleCustomBg: String\n    $broadcastArticleEnable: Boolean\n    $overlayDark: Boolean\n    $brandLayout: DsbBrandLayout\n    $communityLayout: DsbCommunityLayout\n    $changelogLayout: DsbChangelogLayout\n    $docCoverLayout: DsbDocCoverLayout\n    $docFaqLayout: DsbDocFaqLayout\n  ) {\n    updateDashboardLayout(\n      community: $community\n      postLayout: $postLayout\n      kanbanLayout: $kanbanLayout\n      kanbanCardLayout: $kanbanCardLayout\n      kanbanBoards: $kanbanBoards\n      footerLayout: $footerLayout\n      headerLayout: $headerLayout\n      topbarEnabled: $topbarEnabled\n      topbarBg: $topbarBg\n      topbarBgCustomColor: $topbarBgCustomColor\n      tagLayout: $tagLayout\n      inlineTagLayout: $inlineTagLayout\n      avatarLayout: $avatarLayout\n      navActiveLayout: $navActiveLayout\n      broadcastEnable: $broadcastEnable\n      broadcastLayout: $broadcastLayout\n      broadcastBg: $broadcastBg\n      broadcastCustomBg: $broadcastCustomBg\n      broadcastArticleLayout: $broadcastArticleLayout\n      broadcastArticleBg: $broadcastArticleBg\n      broadcastArticleCustomBg: $broadcastArticleCustomBg\n      broadcastArticleEnable: $broadcastArticleEnable\n      kanbanBgColors: $kanbanBgColors\n      overlayDark: $overlayDark\n      brandLayout: $brandLayout\n      communityLayout: $communityLayout\n      changelogLayout: $changelogLayout\n      docCoverLayout: $docCoverLayout\n      docFaqLayout: $docFaqLayout\n    ) {\n      layout {\n        postLayout\n        kanbanLayout\n        kanbanCardLayout\n        kanbanBoards\n        kanbanBgColors\n        docCoverLayout\n        docFaqLayout\n        tagLayout\n        inlineTagLayout\n        avatarLayout\n        brandLayout\n        communityLayout\n        navActiveLayout\n        topbarEnabled\n        topbarBg\n        topbarBgCustomColor\n        broadcastLayout\n        broadcastBg\n        broadcastCustomBg\n        broadcastEnable\n        broadcastArticleLayout\n        broadcastArticleBg\n        broadcastArticleCustomBg\n        broadcastArticleEnable\n        changelogLayout\n        footerLayout\n        headerLayout\n        overlayDark\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateCommunityAssetUploadIntent(\n    $community: String!\n    $file: CommunityAssetUploadFileInput!\n  ) {\n    createCommunityAssetUploadIntent(community: $community, file: $file) {\n      uploadRef\n      assetPublicRef\n      objectKey\n      capability\n      expiresAt\n      maxSizeBytes\n      allowedMimeTypes\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateCommunityAssetUploadIntent(\n    $community: String!\n    $file: CommunityAssetUploadFileInput!\n  ) {\n    createCommunityAssetUploadIntent(community: $community, file: $file) {\n      uploadRef\n      assetPublicRef\n      objectKey\n      capability\n      expiresAt\n      maxSizeBytes\n      allowedMimeTypes\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query PagedCommunityAssets($community: String!, $filter: CommunityAssetFilter) {\n    pagedCommunityAssets(community: $community, filter: $filter) {\n      entries {\n        id\n        publicRef\n        thread\n        assetType\n        status\n        filename\n        mimeType\n        sizeBytes\n        storage\n        storageKey\n        contentHash\n        width\n        height\n        url\n        uploader {\n          login\n          nickname\n        }\n        deletedAt\n        insertedAt\n      }\n      pageNumber\n      pageSize\n      totalCount\n      totalPages\n    }\n  }\n',
): (typeof documents)['\n  query PagedCommunityAssets($community: String!, $filter: CommunityAssetFilter) {\n    pagedCommunityAssets(community: $community, filter: $filter) {\n      entries {\n        id\n        publicRef\n        thread\n        assetType\n        status\n        filename\n        mimeType\n        sizeBytes\n        storage\n        storageKey\n        contentHash\n        width\n        height\n        url\n        uploader {\n          login\n          nickname\n        }\n        deletedAt\n        insertedAt\n      }\n      pageNumber\n      pageSize\n      totalCount\n      totalPages\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommunityAssetStats($community: String!, $filter: CommunityAssetFilter) {\n    communityAssetStats(community: $community, filter: $filter) {\n      totalCount\n      storageBytes\n      storageLimitBytes\n      byThread {\n        thread\n        count\n      }\n      byAssetType {\n        assetType\n        count\n        subtypes {\n          key\n          label\n          count\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query CommunityAssetStats($community: String!, $filter: CommunityAssetFilter) {\n    communityAssetStats(community: $community, filter: $filter) {\n      totalCount\n      storageBytes\n      storageLimitBytes\n      byThread {\n        thread\n        count\n      }\n      byAssetType {\n        assetType\n        count\n        subtypes {\n          key\n          label\n          count\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CommunityAssetRefs($community: String!, $assetId: ID!, $filter: PagiFilter) {\n    communityAssetRefs(community: $community, assetId: $assetId, filter: $filter) {\n      entries {\n        id\n        thread\n        articleId\n        usage\n        blockId\n        blockType\n        position\n        title\n        alt\n        source\n        insertedAt\n      }\n      pageNumber\n      pageSize\n      totalCount\n      totalPages\n    }\n  }\n',
): (typeof documents)['\n  query CommunityAssetRefs($community: String!, $assetId: ID!, $filter: PagiFilter) {\n    communityAssetRefs(community: $community, assetId: $assetId, filter: $filter) {\n      entries {\n        id\n        thread\n        articleId\n        usage\n        blockId\n        blockType\n        position\n        title\n        alt\n        source\n        insertedAt\n      }\n      pageNumber\n      pageSize\n      totalCount\n      totalPages\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteCommunityAsset($community: String!, $id: ID!) {\n    deleteCommunityAsset(community: $community, id: $id) {\n      id\n      publicRef\n      status\n      deletedAt\n    }\n  }\n',
): (typeof documents)['\n  mutation DeleteCommunityAsset($community: String!, $id: ID!) {\n    deleteCommunityAsset(community: $community, id: $id) {\n      id\n      publicRef\n      status\n      deletedAt\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardTrashedPosts($community: String!, $page: Int!, $size: Int!) {\n    trashedArticles(community: $community, thread: POST, filter: { page: $page, size: $size }) {\n      entries {\n        id\n        thread\n        articleRef\n        deletedAt\n        scheduledPermanentDeletionAt\n        mentionedByCount\n        deletedBy {\n          ...DashboardAuthorFields\n        }\n        article {\n          innerId\n          title\n          views\n          upvotesCount\n          meta {\n            thread\n          }\n          ... on Post {\n            cat\n            status\n            commentsCount\n            insertedAt\n            activeAt\n            author {\n              ...DashboardAuthorFields\n            }\n            communityTags {\n              ...DashboardTagFields\n            }\n          }\n        }\n      }\n      ...DashboardTrashedArticlesPageInfo\n    }\n  }\n',
): (typeof documents)['\n  query DashboardTrashedPosts($community: String!, $page: Int!, $size: Int!) {\n    trashedArticles(community: $community, thread: POST, filter: { page: $page, size: $size }) {\n      entries {\n        id\n        thread\n        articleRef\n        deletedAt\n        scheduledPermanentDeletionAt\n        mentionedByCount\n        deletedBy {\n          ...DashboardAuthorFields\n        }\n        article {\n          innerId\n          title\n          views\n          upvotesCount\n          meta {\n            thread\n          }\n          ... on Post {\n            cat\n            status\n            commentsCount\n            insertedAt\n            activeAt\n            author {\n              ...DashboardAuthorFields\n            }\n            communityTags {\n              ...DashboardTagFields\n            }\n          }\n        }\n      }\n      ...DashboardTrashedArticlesPageInfo\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation restoreTrashedPost($community: String!, $id: ID!) {\n    restoreTrashedArticle(community: $community, id: $id, thread: POST) {\n      innerId\n      title\n    }\n  }\n',
): (typeof documents)['\n  mutation restoreTrashedPost($community: String!, $id: ID!) {\n    restoreTrashedArticle(community: $community, id: $id, thread: POST) {\n      innerId\n      title\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation permanentlyDeleteTrashedPost($community: String!, $id: ID!) {\n    permanentlyDeleteTrashedArticle(community: $community, id: $id, thread: POST) {\n      done\n    }\n  }\n',
): (typeof documents)['\n  mutation permanentlyDeleteTrashedPost($community: String!, $id: ID!) {\n    permanentlyDeleteTrashedArticle(community: $community, id: $id, thread: POST) {\n      done\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardDocTreeNodeFields on DocTreeNode {\n    id\n    parentNodeId\n    docId\n    type\n    title\n    index\n    href\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n      appearance {\n        light {\n          color\n          bg\n        }\n        dark {\n          color\n          bg\n        }\n      }\n    }\n    badge\n    hidden\n    publishState {\n      status\n      published\n      publishedBefore\n      hasDraft\n      publicNodeId\n      publicDocId\n      hasUnpublishedChanges\n      lastPublishedAt\n      inCover\n      hiddenFromCover\n      pinnedToCover\n    }\n  }\n',
): (typeof documents)['\n  fragment DashboardDocTreeNodeFields on DocTreeNode {\n    id\n    parentNodeId\n    docId\n    type\n    title\n    index\n    href\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n      appearance {\n        light {\n          color\n          bg\n        }\n        dark {\n          color\n          bg\n        }\n      }\n    }\n    badge\n    hidden\n    publishState {\n      status\n      published\n      publishedBefore\n      hasDraft\n      publicNodeId\n      publicDocId\n      hasUnpublishedChanges\n      lastPublishedAt\n      inCover\n      hiddenFromCover\n      pinnedToCover\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardDocTreeChildFields on DocTreeNode {\n    ...DashboardDocTreeNodeFields\n    pages {\n      ...DashboardDocTreeNodeFields\n    }\n  }\n',
): (typeof documents)['\n  fragment DashboardDocTreeChildFields on DocTreeNode {\n    ...DashboardDocTreeNodeFields\n    pages {\n      ...DashboardDocTreeNodeFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardDocTreeGroupFields on DocTreeNode {\n    ...DashboardDocTreeNodeFields\n    pages {\n      ...DashboardDocTreeChildFields\n    }\n  }\n',
): (typeof documents)['\n  fragment DashboardDocTreeGroupFields on DocTreeNode {\n    ...DashboardDocTreeNodeFields\n    pages {\n      ...DashboardDocTreeChildFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardDocPublishChecklistItemFields on DocPublishChecklistItem {\n    id\n    title\n    action\n    selectedByDefault\n    selectable\n    disabledReason\n  }\n',
): (typeof documents)['\n  fragment DashboardDocPublishChecklistItemFields on DocPublishChecklistItem {\n    id\n    title\n    action\n    selectedByDefault\n    selectable\n    disabledReason\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardDocTreeMutationPayload on DocTreeMutationPayload {\n    revision\n    treeState {\n      hasUnpublishedChanges\n      stagedEventCount\n      baseSnapshotId\n      latestSnapshotId\n      latestReleaseId\n      latestReleaseNumber\n      revision\n    }\n    conflict\n    node {\n      ...DashboardDocTreeNodeFields\n    }\n    affectedNodes {\n      ...DashboardDocTreeNodeFields\n    }\n  }\n',
): (typeof documents)['\n  fragment DashboardDocTreeMutationPayload on DocTreeMutationPayload {\n    revision\n    treeState {\n      hasUnpublishedChanges\n      stagedEventCount\n      baseSnapshotId\n      latestSnapshotId\n      latestReleaseId\n      latestReleaseNumber\n      revision\n    }\n    conflict\n    node {\n      ...DashboardDocTreeNodeFields\n    }\n    affectedNodes {\n      ...DashboardDocTreeNodeFields\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardDocTree($community: String!) {\n    docTree(community: $community) {\n      revision\n      treeState {\n        hasUnpublishedChanges\n        stagedEventCount\n        baseSnapshotId\n        latestSnapshotId\n        latestReleaseId\n        latestReleaseNumber\n        revision\n      }\n      stagedEvents {\n        id\n        seq\n        eventType\n        payload\n        inversePayload\n        status\n        insertedAt\n      }\n      tabs {\n        ...DashboardDocTreeNodeFields\n        pins {\n          ...DashboardDocTreeNodeFields\n        }\n        groups {\n          ...DashboardDocTreeGroupFields\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardDocTree($community: String!) {\n    docTree(community: $community) {\n      revision\n      treeState {\n        hasUnpublishedChanges\n        stagedEventCount\n        baseSnapshotId\n        latestSnapshotId\n        latestReleaseId\n        latestReleaseNumber\n        revision\n      }\n      stagedEvents {\n        id\n        seq\n        eventType\n        payload\n        inversePayload\n        status\n        insertedAt\n      }\n      tabs {\n        ...DashboardDocTreeNodeFields\n        pins {\n          ...DashboardDocTreeNodeFields\n        }\n        groups {\n          ...DashboardDocTreeGroupFields\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardDocPublishChecklist($community: String!) {\n    docPublishChecklist(community: $community) {\n      totalCount\n      docChanges {\n        ...DashboardDocPublishChecklistItemFields\n      }\n      treeChanges {\n        ...DashboardDocPublishChecklistItemFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardDocPublishChecklist($community: String!) {\n    docPublishChecklist(community: $community) {\n      totalCount\n      docChanges {\n        ...DashboardDocPublishChecklistItemFields\n      }\n      treeChanges {\n        ...DashboardDocPublishChecklistItemFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query docTreeTrashItems($community: String!) {\n    docTreeTrashItems(community: $community) {\n      id\n      nodeId\n      docId\n      type\n      title\n      deletedFromParentNodeId\n      deletedFromIndex\n      deletedAt\n      restoredAt\n    }\n  }\n',
): (typeof documents)['\n  query docTreeTrashItems($community: String!) {\n    docTreeTrashItems(community: $community) {\n      id\n      nodeId\n      docId\n      type\n      title\n      deletedFromParentNodeId\n      deletedFromIndex\n      deletedAt\n      restoredAt\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query docDraft($community: String!, $id: ID!) {\n    docDraft(community: $community, id: $id) {\n      id\n      docId\n      title\n      subtitle\n      slug\n      stage\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n',
): (typeof documents)['\n  query docDraft($community: String!, $id: ID!) {\n    docDraft(community: $community, id: $id) {\n      id\n      docId\n      title\n      subtitle\n      slug\n      stage\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query docDraftSnapshots($community: String!, $id: ID!, $stage: DocSnapshotStage) {\n    docDraftSnapshots(community: $community, id: $id, stage: $stage) {\n      id\n      thread\n      stage\n      action\n      articleHashId\n      title\n      slug\n      subtitle\n      digest\n      documentJson\n      versionHash\n      revisionNumber\n      schemaVersion\n      insertedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n',
): (typeof documents)['\n  query docDraftSnapshots($community: String!, $id: ID!, $stage: DocSnapshotStage) {\n    docDraftSnapshots(community: $community, id: $id, stage: $stage) {\n      id\n      thread\n      stage\n      action\n      articleHashId\n      title\n      slug\n      subtitle\n      digest\n      documentJson\n      versionHash\n      revisionNumber\n      schemaVersion\n      insertedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateDocTreeNode(\n    $community: String!\n    $baseRevision: Int!\n    $parentNodeId: ID\n    $input: DocTreeNodeInput!\n  ) {\n    createDocTreeNode(\n      community: $community\n      baseRevision: $baseRevision\n      parentNodeId: $parentNodeId\n      input: $input\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateDocTreeNode(\n    $community: String!\n    $baseRevision: Int!\n    $parentNodeId: ID\n    $input: DocTreeNodeInput!\n  ) {\n    createDocTreeNode(\n      community: $community\n      baseRevision: $baseRevision\n      parentNodeId: $parentNodeId\n      input: $input\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDocTreeNode(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $patch: DocTreeNodePatchInput!\n  ) {\n    updateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision, patch: $patch) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDocTreeNode(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $patch: DocTreeNodePatchInput!\n  ) {\n    updateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision, patch: $patch) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDocDraft(\n    $community: String!\n    $id: ID!\n    $expectedVersion: Int!\n    $title: String\n    $subtitle: String\n    $slug: String\n    $bodyBag: ArtimentBodyBagInput\n  ) {\n    updateDocDraft(\n      community: $community\n      id: $id\n      expectedVersion: $expectedVersion\n      title: $title\n      subtitle: $subtitle\n      slug: $slug\n      bodyBag: $bodyBag\n    ) {\n      id\n      docId\n      title\n      subtitle\n      slug\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDocDraft(\n    $community: String!\n    $id: ID!\n    $expectedVersion: Int!\n    $title: String\n    $subtitle: String\n    $slug: String\n    $bodyBag: ArtimentBodyBagInput\n  ) {\n    updateDocDraft(\n      community: $community\n      id: $id\n      expectedVersion: $expectedVersion\n      title: $title\n      subtitle: $subtitle\n      slug: $slug\n      bodyBag: $bodyBag\n    ) {\n      id\n      docId\n      title\n      subtitle\n      slug\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation checkpointDocDraftSnapshot($community: String!, $id: ID!) {\n    checkpointDocDraftSnapshot(community: $community, id: $id) {\n      id\n      thread\n      stage\n      action\n      articleHashId\n      title\n      slug\n      subtitle\n      documentJson\n      digest\n      versionHash\n      revisionNumber\n      schemaVersion\n      insertedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation checkpointDocDraftSnapshot($community: String!, $id: ID!) {\n    checkpointDocDraftSnapshot(community: $community, id: $id) {\n      id\n      thread\n      stage\n      action\n      articleHashId\n      title\n      slug\n      subtitle\n      documentJson\n      digest\n      versionHash\n      revisionNumber\n      schemaVersion\n      insertedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation publishDocChanges(\n    $community: String!\n    $input: DocPublishChangesInput\n    $mode: DocPublishMode\n  ) {\n    publishDocChanges(community: $community, input: $input, mode: $mode) {\n      done\n      release {\n        id\n        releaseNumber\n        publishedAt\n      }\n      checklist {\n        totalCount\n        docChanges {\n          ...DashboardDocPublishChecklistItemFields\n        }\n        treeChanges {\n          ...DashboardDocPublishChecklistItemFields\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation publishDocChanges(\n    $community: String!\n    $input: DocPublishChangesInput\n    $mode: DocPublishMode\n  ) {\n    publishDocChanges(community: $community, input: $input, mode: $mode) {\n      done\n      release {\n        id\n        releaseNumber\n        publishedAt\n      }\n      checklist {\n        totalCount\n        docChanges {\n          ...DashboardDocPublishChecklistItemFields\n        }\n        treeChanges {\n          ...DashboardDocPublishChecklistItemFields\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation moveDocToDraft($community: String!, $id: ID!) {\n    moveDocToDraft(community: $community, id: $id) {\n      docId\n      stage\n      publishState {\n        status\n        published\n        publishedBefore\n        hasDraft\n        publicNodeId\n        publicDocId\n        hasUnpublishedChanges\n        lastPublishedAt\n        inCover\n        hiddenFromCover\n        pinnedToCover\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation moveDocToDraft($community: String!, $id: ID!) {\n    moveDocToDraft(community: $community, id: $id) {\n      docId\n      stage\n      publishState {\n        status\n        published\n        publishedBefore\n        hasDraft\n        publicNodeId\n        publicDocId\n        hasUnpublishedChanges\n        lastPublishedAt\n        inCover\n        hiddenFromCover\n        pinnedToCover\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation moveDocTreeSubtreeToDraft($community: String!, $nodeId: ID!) {\n    moveDocTreeSubtreeToDraft(community: $community, nodeId: $nodeId) {\n      done\n    }\n  }\n',
): (typeof documents)['\n  mutation moveDocTreeSubtreeToDraft($community: String!, $nodeId: ID!) {\n    moveDocTreeSubtreeToDraft(community: $community, nodeId: $nodeId) {\n      done\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation restoreDocDraftSnapshot($community: String!, $id: ID!, $snapshotId: ID!) {\n    restoreDocDraftSnapshot(community: $community, id: $id, snapshotId: $snapshotId) {\n      id\n      title\n      subtitle\n      slug\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation restoreDocDraftSnapshot($community: String!, $id: ID!, $snapshotId: ID!) {\n    restoreDocDraftSnapshot(community: $community, id: $id, snapshotId: $snapshotId) {\n      id\n      title\n      subtitle\n      slug\n      digest\n      insertedAt\n      updatedAt\n      author {\n        login\n        nickname\n        avatar\n      }\n      document {\n        json\n        markdown\n        markdownToc\n        html\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {\n    deleteDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n',
): (typeof documents)['\n  mutation DeleteDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {\n    deleteDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RestoreDocTreeTrashItem(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $targetParentNodeId: ID\n    $targetIndex: Int\n  ) {\n    restoreDocTreeTrashItem(\n      community: $community\n      id: $id\n      baseRevision: $baseRevision\n      targetParentNodeId: $targetParentNodeId\n      targetIndex: $targetIndex\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n',
): (typeof documents)['\n  mutation RestoreDocTreeTrashItem(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $targetParentNodeId: ID\n    $targetIndex: Int\n  ) {\n    restoreDocTreeTrashItem(\n      community: $community\n      id: $id\n      baseRevision: $baseRevision\n      targetParentNodeId: $targetParentNodeId\n      targetIndex: $targetIndex\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DuplicateDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {\n    duplicateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n',
): (typeof documents)['\n  mutation DuplicateDocTreeNode($community: String!, $id: ID!, $baseRevision: Int!) {\n    duplicateDocTreeNode(community: $community, id: $id, baseRevision: $baseRevision) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation MoveDocTreeNode(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $targetParentNodeId: ID\n    $targetIndex: Int\n  ) {\n    moveDocTreeNode(\n      community: $community\n      id: $id\n      baseRevision: $baseRevision\n      targetParentNodeId: $targetParentNodeId\n      targetIndex: $targetIndex\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n',
): (typeof documents)['\n  mutation MoveDocTreeNode(\n    $community: String!\n    $id: ID!\n    $baseRevision: Int!\n    $targetParentNodeId: ID\n    $targetIndex: Int\n  ) {\n    moveDocTreeNode(\n      community: $community\n      id: $id\n      baseRevision: $baseRevision\n      targetParentNodeId: $targetParentNodeId\n      targetIndex: $targetIndex\n    ) {\n      ...DashboardDocTreeMutationPayload\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation addDocCoverCard($community: String!, $groupNodeId: ID!) {\n    addDocCoverCard(community: $community, groupNodeId: $groupNodeId) {\n      id\n      index\n      appearance\n    }\n  }\n',
): (typeof documents)['\n  mutation addDocCoverCard($community: String!, $groupNodeId: ID!) {\n    addDocCoverCard(community: $community, groupNodeId: $groupNodeId) {\n      id\n      index\n      appearance\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation removeDocCoverCard($community: String!, $groupNodeId: ID!) {\n    removeDocCoverCard(community: $community, groupNodeId: $groupNodeId) {\n      id\n      index\n      appearance\n    }\n  }\n',
): (typeof documents)['\n  mutation removeDocCoverCard($community: String!, $groupNodeId: ID!) {\n    removeDocCoverCard(community: $community, groupNodeId: $groupNodeId) {\n      id\n      index\n      appearance\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation reorderDocCoverCards($community: String!, $ids: [ID!]!) {\n    reorderDocCoverCards(community: $community, ids: $ids) {\n      done\n    }\n  }\n',
): (typeof documents)['\n  mutation reorderDocCoverCards($community: String!, $ids: [ID!]!) {\n    reorderDocCoverCards(community: $community, ids: $ids) {\n      done\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation pinDocToCover($community: String!, $nodeId: ID!) {\n    pinDocToCover(community: $community, nodeId: $nodeId) {\n      nodeId\n      index\n      appearance\n    }\n  }\n',
): (typeof documents)['\n  mutation pinDocToCover($community: String!, $nodeId: ID!) {\n    pinDocToCover(community: $community, nodeId: $nodeId) {\n      nodeId\n      index\n      appearance\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation unpinDocFromCover($community: String!, $nodeId: ID!) {\n    unpinDocFromCover(community: $community, nodeId: $nodeId) {\n      nodeId\n    }\n  }\n',
): (typeof documents)['\n  mutation unpinDocFromCover($community: String!, $nodeId: ID!) {\n    unpinDocFromCover(community: $community, nodeId: $nodeId) {\n      nodeId\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation reorderDocCoverPinnedDocs($community: String!, $nodeIds: [ID!]!) {\n    reorderDocCoverPinnedDocs(community: $community, nodeIds: $nodeIds) {\n      done\n    }\n  }\n',
): (typeof documents)['\n  mutation reorderDocCoverPinnedDocs($community: String!, $nodeIds: [ID!]!) {\n    reorderDocCoverPinnedDocs(community: $community, nodeIds: $nodeIds) {\n      done\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation updateDocCoverCardAppearance($community: String!, $id: ID!, $appearance: Json!) {\n    updateDocCoverCardAppearance(community: $community, id: $id, appearance: $appearance) {\n      id\n      appearance\n    }\n  }\n',
): (typeof documents)['\n  mutation updateDocCoverCardAppearance($community: String!, $id: ID!, $appearance: Json!) {\n    updateDocCoverCardAppearance(community: $community, id: $id, appearance: $appearance) {\n      id\n      appearance\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation updatePinnedDocAppearance($community: String!, $nodeId: ID!, $appearance: Json!) {\n    updatePinnedDocAppearance(community: $community, nodeId: $nodeId, appearance: $appearance) {\n      nodeId\n      appearance\n    }\n  }\n',
): (typeof documents)['\n  mutation updatePinnedDocAppearance($community: String!, $nodeId: ID!, $appearance: Json!) {\n    updatePinnedDocAppearance(community: $community, nodeId: $nodeId, appearance: $appearance) {\n      nodeId\n      appearance\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n',
): (typeof documents)['\n  fragment DashboardAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n',
): (typeof documents)['\n  fragment DashboardTagFields on CommunityTag {\n    id\n    title\n    layout\n    desc\n    slug\n    color\n    marker {\n      type\n      provider\n      name\n      src\n      unified\n    }\n    thread\n    group\n    groupId\n    index\n    community {\n      slug\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardThirdPartyAnalyticsFields on DsbThirdPartyAnalytics {\n    provider\n    enabled\n    measurementId\n    containerId\n    projectId\n    domain\n    siteId\n  }\n',
): (typeof documents)['\n  fragment DashboardThirdPartyAnalyticsFields on DsbThirdPartyAnalytics {\n    provider\n    enabled\n    measurementId\n    containerId\n    projectId\n    domain\n    siteId\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardHeaderLinkFields on DsbLink {\n    id\n    type\n    title\n    url\n    links {\n      id\n      title\n      url\n    }\n  }\n',
): (typeof documents)['\n  fragment DashboardHeaderLinkFields on DsbLink {\n    id\n    type\n    title\n    url\n    links {\n      id\n      title\n      url\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardFooterOnelineLinkFields on DsbLinkChild {\n    id\n    title\n    url\n  }\n',
): (typeof documents)['\n  fragment DashboardFooterOnelineLinkFields on DsbLinkChild {\n    id\n    title\n    url\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment DashboardTrashedArticlesPageInfo on PagedTrashedArticles {\n    totalCount\n    pageSize\n    totalPages\n    pageNumber\n  }\n',
): (typeof documents)['\n  fragment DashboardTrashedArticlesPageInfo on PagedTrashedArticles {\n    totalCount\n    pageSize\n    totalPages\n    pageNumber\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardPressConfig($community: String!) {\n    pressConfig(community: $community) {\n      markdownEnabled\n      feedEnabled\n      feedType\n      feedCount\n      feedThreads\n      llmsEnabled\n      sitemapEnabled\n      revision\n    }\n  }\n',
): (typeof documents)['\n  query DashboardPressConfig($community: String!) {\n    pressConfig(community: $community) {\n      markdownEnabled\n      feedEnabled\n      feedType\n      feedCount\n      feedThreads\n      llmsEnabled\n      sitemapEnabled\n      revision\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardPressConfig($input: UpdatePressConfigInput!) {\n    updatePressConfig(input: $input) {\n      config {\n        markdownEnabled\n        feedEnabled\n        feedType\n        feedCount\n        feedThreads\n        llmsEnabled\n        sitemapEnabled\n        revision\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardPressConfig($input: UpdatePressConfigInput!) {\n    updatePressConfig(input: $input) {\n      config {\n        markdownEnabled\n        feedEnabled\n        feedType\n        feedCount\n        feedThreads\n        llmsEnabled\n        sitemapEnabled\n        revision\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardThirdPartyAnalyticsProviders {\n    thirdPartyAnalyticsProviders {\n      provider\n      title\n      desc\n      detail\n      docsUrl\n      icon\n      identityField\n      configFields {\n        key\n        label\n        desc\n        placeholder\n        requiredWhenEnabled\n        pattern\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardThirdPartyAnalyticsProviders {\n    thirdPartyAnalyticsProviders {\n      provider\n      title\n      desc\n      detail\n      docsUrl\n      icon\n      identityField\n      configFields {\n        key\n        label\n        desc\n        placeholder\n        requiredWhenEnabled\n        pattern\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardOpenGraphInfo($url: String!) {\n    openGraphInfo(url: $url) {\n      title\n      favicon\n      url\n      siteName\n    }\n  }\n',
): (typeof documents)['\n  query DashboardOpenGraphInfo($url: String!) {\n    openGraphInfo(url: $url) {\n      title\n      favicon\n      url\n      siteName\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardBaseInfo(\n    $community: String!\n    $homepage: String\n    $title: String\n    $slug: String\n    $desc: String\n    $locale: String\n    $introduction: String\n    $logo: String\n    $favicon: String\n    $city: String\n    $techstack: String\n  ) {\n    updateDashboardBaseInfo(\n      community: $community\n      homepage: $homepage\n      title: $title\n      slug: $slug\n      desc: $desc\n      locale: $locale\n      introduction: $introduction\n      logo: $logo\n      favicon: $favicon\n      city: $city\n      techstack: $techstack\n    ) {\n      baseInfo {\n        title\n        logo\n        favicon\n        locale\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardBaseInfo(\n    $community: String!\n    $homepage: String\n    $title: String\n    $slug: String\n    $desc: String\n    $locale: String\n    $introduction: String\n    $logo: String\n    $favicon: String\n    $city: String\n    $techstack: String\n  ) {\n    updateDashboardBaseInfo(\n      community: $community\n      homepage: $homepage\n      title: $title\n      slug: $slug\n      desc: $desc\n      locale: $locale\n      introduction: $introduction\n      logo: $logo\n      favicon: $favicon\n      city: $city\n      techstack: $techstack\n    ) {\n      baseInfo {\n        title\n        logo\n        favicon\n        locale\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardMediaReports($community: String!, $mediaReports: [DsbMediaReportMap]) {\n    updateDashboardMediaReports(community: $community, mediaReports: $mediaReports) {\n      mediaReports {\n        index\n        title\n        url\n        favicon\n        siteName\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardMediaReports($community: String!, $mediaReports: [DsbMediaReportMap]) {\n    updateDashboardMediaReports(community: $community, mediaReports: $mediaReports) {\n      mediaReports {\n        index\n        title\n        url\n        favicon\n        siteName\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardThirdPartyAnalytics(\n    $community: String!\n    $thirdPartyAnalytics: [DsbThirdPartyAnalyticsInput]\n  ) {\n    updateDashboardThirdPartyAnalytics(\n      community: $community\n      thirdPartyAnalytics: $thirdPartyAnalytics\n    ) {\n      thirdPartyAnalytics {\n        ...DashboardThirdPartyAnalyticsFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardThirdPartyAnalytics(\n    $community: String!\n    $thirdPartyAnalytics: [DsbThirdPartyAnalyticsInput]\n  ) {\n    updateDashboardThirdPartyAnalytics(\n      community: $community\n      thirdPartyAnalytics: $thirdPartyAnalytics\n    ) {\n      thirdPartyAnalytics {\n        ...DashboardThirdPartyAnalyticsFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardSeo(\n    $community: String!\n    $seoEnable: Boolean\n    $ogSiteName: String\n    $ogTitle: String\n    $ogDescription: String\n    $ogUrl: String\n    $ogImage: String\n    $ogLocale: String\n    $ogPublisher: String\n    $twTitle: String\n    $twDescription: String\n    $twUrl: String\n    $twCard: String\n    $twSite: String\n    $twImage: String\n    $twImageWidth: String\n    $twImageHeight: String\n  ) {\n    updateDashboardSeo(\n      community: $community\n      seoEnable: $seoEnable\n      ogSiteName: $ogSiteName\n      ogTitle: $ogTitle\n      ogDescription: $ogDescription\n      ogUrl: $ogUrl\n      ogImage: $ogImage\n      ogLocale: $ogLocale\n      ogPublisher: $ogPublisher\n      twTitle: $twTitle\n      twDescription: $twDescription\n      twUrl: $twUrl\n      twCard: $twCard\n      twSite: $twSite\n      twImage: $twImage\n      twImageWidth: $twImageWidth\n      twImageHeight: $twImageHeight\n    ) {\n      seo {\n        seoEnable\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardSeo(\n    $community: String!\n    $seoEnable: Boolean\n    $ogSiteName: String\n    $ogTitle: String\n    $ogDescription: String\n    $ogUrl: String\n    $ogImage: String\n    $ogLocale: String\n    $ogPublisher: String\n    $twTitle: String\n    $twDescription: String\n    $twUrl: String\n    $twCard: String\n    $twSite: String\n    $twImage: String\n    $twImageWidth: String\n    $twImageHeight: String\n  ) {\n    updateDashboardSeo(\n      community: $community\n      seoEnable: $seoEnable\n      ogSiteName: $ogSiteName\n      ogTitle: $ogTitle\n      ogDescription: $ogDescription\n      ogUrl: $ogUrl\n      ogImage: $ogImage\n      ogLocale: $ogLocale\n      ogPublisher: $ogPublisher\n      twTitle: $twTitle\n      twDescription: $twDescription\n      twUrl: $twUrl\n      twCard: $twCard\n      twSite: $twSite\n      twImage: $twImage\n      twImageWidth: $twImageWidth\n      twImageHeight: $twImageHeight\n    ) {\n      seo {\n        seoEnable\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardEnable(\n    $community: String!\n    $post: Boolean\n    $blog: Boolean\n    $kanban: Boolean\n    $changelog: Boolean\n    $doc: Boolean\n    $docLastUpdate: Boolean\n    $docReaction: Boolean\n    $about: Boolean\n    $aboutTechstack: Boolean\n    $aboutLocation: Boolean\n    $aboutLinks: Boolean\n    $aboutMediaReport: Boolean\n    $visitorLocationMap: Boolean\n  ) {\n    updateDashboardEnable(\n      community: $community\n      post: $post\n      blog: $blog\n      kanban: $kanban\n      changelog: $changelog\n      doc: $doc\n      docLastUpdate: $docLastUpdate\n      docReaction: $docReaction\n      about: $about\n      aboutTechstack: $aboutTechstack\n      aboutLocation: $aboutLocation\n      aboutLinks: $aboutLinks\n      aboutMediaReport: $aboutMediaReport\n      visitorLocationMap: $visitorLocationMap\n    ) {\n      enable {\n        post\n        blog\n        kanban\n        changelog\n        doc\n        docLastUpdate\n        docReaction\n        about\n        aboutTechstack\n        aboutLocation\n        aboutLinks\n        aboutMediaReport\n        visitorLocationMap\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardEnable(\n    $community: String!\n    $post: Boolean\n    $blog: Boolean\n    $kanban: Boolean\n    $changelog: Boolean\n    $doc: Boolean\n    $docLastUpdate: Boolean\n    $docReaction: Boolean\n    $about: Boolean\n    $aboutTechstack: Boolean\n    $aboutLocation: Boolean\n    $aboutLinks: Boolean\n    $aboutMediaReport: Boolean\n    $visitorLocationMap: Boolean\n  ) {\n    updateDashboardEnable(\n      community: $community\n      post: $post\n      blog: $blog\n      kanban: $kanban\n      changelog: $changelog\n      doc: $doc\n      docLastUpdate: $docLastUpdate\n      docReaction: $docReaction\n      about: $about\n      aboutTechstack: $aboutTechstack\n      aboutLocation: $aboutLocation\n      aboutLinks: $aboutLinks\n      aboutMediaReport: $aboutMediaReport\n      visitorLocationMap: $visitorLocationMap\n    ) {\n      enable {\n        post\n        blog\n        kanban\n        changelog\n        doc\n        docLastUpdate\n        docReaction\n        about\n        aboutTechstack\n        aboutLocation\n        aboutLinks\n        aboutMediaReport\n        visitorLocationMap\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardSocialLinks($community: String!, $socialLinks: [DsbSocialLinkMap]) {\n    updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {\n      socialLinks {\n        type\n        link\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardSocialLinks($community: String!, $socialLinks: [DsbSocialLinkMap]) {\n    updateDashboardSocialLinks(community: $community, socialLinks: $socialLinks) {\n      socialLinks {\n        type\n        link\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardNameAlias($community: String!, $nameAlias: [DsbAliasMap]) {\n    updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {\n      nameAlias {\n        original\n        name\n        slug\n        group\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardNameAlias($community: String!, $nameAlias: [DsbAliasMap]) {\n    updateDashboardNameAlias(community: $community, nameAlias: $nameAlias) {\n      nameAlias {\n        original\n        name\n        slug\n        group\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardDocFaq($community: String!, $docFaq: DsbDocFaqInput!) {\n    updateDashboardDocFaq(community: $community, docFaq: $docFaq) {\n      docFaq {\n        title\n        desc\n        groupedView\n        groupItems {\n          id\n          title\n          index\n          items {\n            id\n            title\n            detail\n            index\n          }\n        }\n        flatItems {\n          id\n          title\n          detail\n          index\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardDocFaq($community: String!, $docFaq: DsbDocFaqInput!) {\n    updateDashboardDocFaq(community: $community, docFaq: $docFaq) {\n      docFaq {\n        title\n        desc\n        groupedView\n        groupItems {\n          id\n          title\n          index\n          items {\n            id\n            title\n            detail\n            index\n          }\n        }\n        flatItems {\n          id\n          title\n          detail\n          index\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardHeaderLinks($community: String!, $headerLinks: [DsbLinkMap]) {\n    updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {\n      headerLinks {\n        ...DashboardHeaderLinkFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardHeaderLinks($community: String!, $headerLinks: [DsbLinkMap]) {\n    updateDashboardHeaderLinks(community: $community, headerLinks: $headerLinks) {\n      headerLinks {\n        ...DashboardHeaderLinkFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardFooterLinks($community: String!, $footerLinks: [DsbLinkMap]) {\n    updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {\n      footerLinks {\n        ...DashboardHeaderLinkFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardFooterLinks($community: String!, $footerLinks: [DsbLinkMap]) {\n    updateDashboardFooterLinks(community: $community, footerLinks: $footerLinks) {\n      footerLinks {\n        ...DashboardHeaderLinkFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateDashboardFooterOnelineLinks(\n    $community: String!\n    $footerOnelineLinks: [DsbLinkChildMap]\n  ) {\n    updateDashboardFooterOnelineLinks(\n      community: $community\n      footerOnelineLinks: $footerOnelineLinks\n    ) {\n      footerOnelineLinks {\n        ...DashboardFooterOnelineLinkFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateDashboardFooterOnelineLinks(\n    $community: String!\n    $footerOnelineLinks: [DsbLinkChildMap]\n  ) {\n    updateDashboardFooterOnelineLinks(\n      community: $community\n      footerOnelineLinks: $footerOnelineLinks\n    ) {\n      footerOnelineLinks {\n        ...DashboardFooterOnelineLinkFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardCommunityBaseInfo($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      dashboard {\n        baseInfo {\n          title\n          locale\n          favicon\n          logo\n          slug\n          desc\n          introduction\n          homepage\n          city\n          techstack\n        }\n        mediaReports {\n          url\n          title\n          siteName\n          favicon\n          index\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardCommunityBaseInfo($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      dashboard {\n        baseInfo {\n          title\n          locale\n          favicon\n          logo\n          slug\n          desc\n          introduction\n          homepage\n          city\n          techstack\n        }\n        mediaReports {\n          url\n          title\n          siteName\n          favicon\n          index\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardCommunitySocialLinks($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      dashboard {\n        socialLinks {\n          type\n          link\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardCommunitySocialLinks($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      dashboard {\n        socialLinks {\n          type\n          link\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardCommunityOverview($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      views\n      subscribersCount\n      meta {\n        postsCount\n        changelogsCount\n        docsCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardCommunityOverview($slug: String!, $incViews: Boolean) {\n    community(slug: $slug, incViews: $incViews) {\n      views\n      subscribersCount\n      meta {\n        postsCount\n        changelogsCount\n        docsCount\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query DashboardCommunityTagGroups($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  query DashboardCommunityTagGroups($community: String!, $thread: Thread) {\n    communityTagGroups(community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardUpdateCommunityTag(\n    $id: ID!\n    $color: RainbowColor\n    $title: String\n    $slug: String\n    $community: String!\n    $extra: [String]\n    $marker: MarkerInput\n    $groupId: ID\n  ) {\n    updateCommunityTag(\n      id: $id\n      color: $color\n      title: $title\n      slug: $slug\n      community: $community\n      extra: $extra\n      marker: $marker\n      groupId: $groupId\n    ) {\n      id\n      title\n      slug\n      color\n      groupId\n      extra\n      marker {\n        type\n        provider\n        name\n        src\n        unified\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardUpdateCommunityTag(\n    $id: ID!\n    $color: RainbowColor\n    $title: String\n    $slug: String\n    $community: String!\n    $extra: [String]\n    $marker: MarkerInput\n    $groupId: ID\n  ) {\n    updateCommunityTag(\n      id: $id\n      color: $color\n      title: $title\n      slug: $slug\n      community: $community\n      extra: $extra\n      marker: $marker\n      groupId: $groupId\n    ) {\n      id\n      title\n      slug\n      color\n      groupId\n      extra\n      marker {\n        type\n        provider\n        name\n        src\n        unified\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardCreateCommunityTagGroup(\n    $thread: Thread!\n    $title: String!\n    $community: String!\n  ) {\n    createCommunityTagGroup(thread: $thread, title: $title, community: $community) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardCreateCommunityTagGroup(\n    $thread: Thread!\n    $title: String!\n    $community: String!\n  ) {\n    createCommunityTagGroup(thread: $thread, title: $title, community: $community) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardUpdateCommunityTagGroup(\n    $id: ID!\n    $title: String!\n    $community: String!\n    $thread: Thread\n  ) {\n    updateCommunityTagGroup(id: $id, title: $title, community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardUpdateCommunityTagGroup(\n    $id: ID!\n    $title: String!\n    $community: String!\n    $thread: Thread\n  ) {\n    updateCommunityTagGroup(id: $id, title: $title, community: $community, thread: $thread) {\n      id\n      title\n      index\n      tags {\n        ...DashboardTagFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardCreateCommunityTag(\n    $thread: Thread!\n    $title: String!\n    $slug: String!\n    $layout: String\n    $color: RainbowColor!\n    $groupId: ID!\n    $community: String!\n    $marker: MarkerInput\n  ) {\n    createCommunityTag(\n      thread: $thread\n      title: $title\n      slug: $slug\n      layout: $layout\n      color: $color\n      groupId: $groupId\n      community: $community\n      marker: $marker\n    ) {\n      id\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardCreateCommunityTag(\n    $thread: Thread!\n    $title: String!\n    $slug: String!\n    $layout: String\n    $color: RainbowColor!\n    $groupId: ID!\n    $community: String!\n    $marker: MarkerInput\n  ) {\n    createCommunityTag(\n      thread: $thread\n      title: $title\n      slug: $slug\n      layout: $layout\n      color: $color\n      groupId: $groupId\n      community: $community\n      marker: $marker\n    ) {\n      id\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardReindexTagsInGroup(\n    $community: String!\n    $thread: Thread\n    $groupId: ID!\n    $tags: [ReindexTagInput]\n  ) {\n    reindexTagsInGroup(community: $community, thread: $thread, groupId: $groupId, tags: $tags) {\n      done\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardReindexTagsInGroup(\n    $community: String!\n    $thread: Thread\n    $groupId: ID!\n    $tags: [ReindexTagInput]\n  ) {\n    reindexTagsInGroup(community: $community, thread: $thread, groupId: $groupId, tags: $tags) {\n      done\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardReindexCommunityTags(\n    $community: String!\n    $thread: Thread\n    $tags: [ReindexCommunityTagInput]\n  ) {\n    reindexCommunityTags(community: $community, thread: $thread, tags: $tags) {\n      done\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardReindexCommunityTags(\n    $community: String!\n    $thread: Thread\n    $tags: [ReindexCommunityTagInput]\n  ) {\n    reindexCommunityTags(community: $community, thread: $thread, tags: $tags) {\n      done\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DashboardReindexCommunityTagGroups(\n    $community: String!\n    $thread: Thread\n    $groups: [ReindexCommunityTagGroupInput]\n  ) {\n    reindexCommunityTagGroups(community: $community, thread: $thread, groups: $groups) {\n      done\n    }\n  }\n',
): (typeof documents)['\n  mutation DashboardReindexCommunityTagGroups(\n    $community: String!\n    $thread: Thread\n    $groups: [ReindexCommunityTagGroupInput]\n  ) {\n    reindexCommunityTagGroups(community: $community, thread: $thread, groups: $groups) {\n      done\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment KanbanAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n',
): (typeof documents)['\n  fragment KanbanAuthorFields on User {\n    login\n    nickname\n    avatar\n    bio\n    shortbio\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  fragment KanbanPageFields on PagedPosts {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n',
): (typeof documents)['\n  fragment KanbanPageFields on PagedPosts {\n    totalPages\n    totalCount\n    pageSize\n    pageNumber\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query GroupedKanbanPosts($community: String!) {\n    groupedKanbanPosts(community: $community) {\n      backlog {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      todo {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      wip {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      done {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      rejected {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n    }\n  }\n',
): (typeof documents)['\n  query GroupedKanbanPosts($community: String!) {\n    groupedKanbanPosts(community: $community) {\n      backlog {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      todo {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      wip {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      done {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n      rejected {\n        entries {\n          innerId\n          cat\n          status\n          title\n          community {\n            slug\n          }\n          meta {\n            thread\n          }\n          author {\n            ...KanbanAuthorFields\n          }\n        }\n        ...KanbanPageFields\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query UserPassport($login: String!) {\n    user(login: $login) {\n      passportString\n      social {\n        github\n        twitter\n        zhihu\n      }\n    }\n  }\n',
): (typeof documents)['\n  query UserPassport($login: String!) {\n    user(login: $login) {\n      passportString\n      social {\n        github\n        twitter\n        zhihu\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query AllPassportRules {\n    allPassportRulesString {\n      cms\n    }\n  }\n',
): (typeof documents)['\n  query AllPassportRules {\n    allPassportRulesString {\n      cms\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateModeratorPassport($community: String!, $user: String!, $rules: Json!) {\n    updateModeratorPassport(community: $community, user: $user, rules: $rules) {\n      slug\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateModeratorPassport($community: String!, $user: String!, $rules: Json!) {\n    updateModeratorPassport(community: $community, user: $user, rules: $rules) {\n      slug\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveModerator($community: String!, $user: String!) {\n    removeModerator(community: $community, user: $user) {\n      slug\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation RemoveModerator($community: String!, $user: String!) {\n    removeModerator(community: $community, user: $user) {\n      slug\n      moderators {\n        isRoot\n        passportItemCount\n        user {\n          login\n          avatar\n          nickname\n          bio\n        }\n      }\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n    query PostThreadFresh($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n      post(article: $article) {\n        innerId\n        views\n        upvotesCount\n        commentsCount\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n    }\n  ',
): (typeof documents)['\n    query PostThreadFresh($article: ArticlePathInput!, $userHasLogin: Boolean!) {\n      post(article: $article) {\n        innerId\n        views\n        upvotesCount\n        commentsCount\n        viewerHasViewed @include(if: $userHasLogin)\n        viewerHasUpvoted @include(if: $userHasLogin)\n      }\n    }\n  ']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query RichEditorSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n',
): (typeof documents)['\n  query RichEditorSimpleQuery($article: ArticlePathInput!) {\n    post(article: $article) {\n      innerId\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteCommunityTag($id: ID!, $community: String!, $thread: Thread) {\n    deleteCommunityTag(id: $id, community: $community, thread: $thread) {\n      id\n    }\n  }\n',
): (typeof documents)['\n  mutation DeleteCommunityTag($id: ID!, $community: String!, $thread: Thread) {\n    deleteCommunityTag(id: $id, community: $community, thread: $thread) {\n      id\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateCommunityTag(\n    $thread: Thread!\n    $title: String!\n    $slug: String!\n    $layout: String\n    $color: RainbowColor!\n    $groupId: ID!\n    $community: String!\n    $marker: MarkerInput\n  ) {\n    createCommunityTag(\n      thread: $thread\n      title: $title\n      slug: $slug\n      layout: $layout\n      color: $color\n      groupId: $groupId\n      community: $community\n      marker: $marker\n    ) {\n      id\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateCommunityTag(\n    $thread: Thread!\n    $title: String!\n    $slug: String!\n    $layout: String\n    $color: RainbowColor!\n    $groupId: ID!\n    $community: String!\n    $marker: MarkerInput\n  ) {\n    createCommunityTag(\n      thread: $thread\n      title: $title\n      slug: $slug\n      layout: $layout\n      color: $color\n      groupId: $groupId\n      community: $community\n      marker: $marker\n    ) {\n      id\n    }\n  }\n']
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateCommunityTag(\n    $id: ID!\n    $color: RainbowColor\n    $title: String\n    $layout: String\n    $desc: String\n    $slug: String\n    $community: String!\n    $groupId: ID\n    $marker: MarkerInput\n  ) {\n    updateCommunityTag(\n      id: $id\n      color: $color\n      title: $title\n      desc: $desc\n      layout: $layout\n      slug: $slug\n      community: $community\n      groupId: $groupId\n      marker: $marker\n    ) {\n      id\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateCommunityTag(\n    $id: ID!\n    $color: RainbowColor\n    $title: String\n    $layout: String\n    $desc: String\n    $slug: String\n    $community: String!\n    $groupId: ID\n    $marker: MarkerInput\n  ) {\n    updateCommunityTag(\n      id: $id\n      color: $color\n      title: $title\n      desc: $desc\n      layout: $layout\n      slug: $slug\n      community: $community\n      groupId: $groupId\n      marker: $marker\n    ) {\n      id\n    }\n  }\n']

export function graphql(source: string) {
  return (documents as any)[source] ?? {}
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never
