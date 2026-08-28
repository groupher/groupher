import { graphql } from '~/graphql/authoring'

export const updateDashboardLayout = graphql(`
  mutation UpdateDashboardLayout(
    $community: String!
    $postLayout: DsbPostLayout
    $kanbanLayout: DsbKanbanLayout
    $kanbanCardLayout: DsbKanbanCardLayout
    $kanbanBoards: [KanbanBoard]
    $footerLayout: DsbFooterLayout
    $headerLayout: DsbHeaderLayout
    $topbarEnabled: Boolean
    $topbarBg: RainbowColor
    $topbarBgCustomColor: String
    $tagLayout: DsbTagLayout
    $inlineTagLayout: DsbInlineTagLayout
    $avatarLayout: DsbAvatarLayout
    $navActiveLayout: DsbNavActiveLayout
    $broadcastEnable: Boolean
    $kanbanBgColors: [RainbowColor]
    $broadcastLayout: DsbBroadcastLayout
    $broadcastBg: RainbowColor
    $broadcastCustomBg: String
    $broadcastArticleLayout: DsbBroadcastArticleLayout
    $broadcastArticleBg: RainbowColor
    $broadcastArticleCustomBg: String
    $broadcastArticleEnable: Boolean
    $overlayDark: Boolean
    $brandLayout: DsbBrandLayout
    $communityLayout: DsbCommunityLayout
    $changelogLayout: DsbChangelogLayout
    $docCoverLayout: DsbDocCoverLayout
    $docFaqLayout: DsbDocFaqLayout
  ) {
    updateDashboardLayout(
      community: $community
      postLayout: $postLayout
      kanbanLayout: $kanbanLayout
      kanbanCardLayout: $kanbanCardLayout
      kanbanBoards: $kanbanBoards
      footerLayout: $footerLayout
      headerLayout: $headerLayout
      topbarEnabled: $topbarEnabled
      topbarBg: $topbarBg
      topbarBgCustomColor: $topbarBgCustomColor
      tagLayout: $tagLayout
      inlineTagLayout: $inlineTagLayout
      avatarLayout: $avatarLayout
      navActiveLayout: $navActiveLayout
      broadcastEnable: $broadcastEnable
      broadcastLayout: $broadcastLayout
      broadcastBg: $broadcastBg
      broadcastCustomBg: $broadcastCustomBg
      broadcastArticleLayout: $broadcastArticleLayout
      broadcastArticleBg: $broadcastArticleBg
      broadcastArticleCustomBg: $broadcastArticleCustomBg
      broadcastArticleEnable: $broadcastArticleEnable
      kanbanBgColors: $kanbanBgColors
      overlayDark: $overlayDark
      brandLayout: $brandLayout
      communityLayout: $communityLayout
      changelogLayout: $changelogLayout
      docCoverLayout: $docCoverLayout
      docFaqLayout: $docFaqLayout
    ) {
      layout {
        postLayout
        kanbanLayout
        kanbanCardLayout
        kanbanBoards
        kanbanBgColors
        docCoverLayout
        docFaqLayout
        tagLayout
        inlineTagLayout
        avatarLayout
        brandLayout
        communityLayout
        navActiveLayout
        topbarEnabled
        topbarBg
        topbarBgCustomColor
        broadcastLayout
        broadcastBg
        broadcastCustomBg
        broadcastEnable
        broadcastArticleLayout
        broadcastArticleBg
        broadcastArticleCustomBg
        broadcastArticleEnable
        changelogLayout
        footerLayout
        headerLayout
        overlayDark
      }
    }
  }
`)

export default { updateDashboardLayout }
