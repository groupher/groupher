defmodule GroupherServer.Test.Helper.Schema.Community do
  @moduledoc "GraphQL documents used by community tests."

  def m(:unsubscribe_community) do
    """
    mutation($community: String!){
          unsubscribeCommunity(community: $community) {
            slug
          }
        }
    """
  end

  def m(:create_community) do
    """
    mutation($title: String!, $desc: String!, $logo: String!, $slug: String!, $locale: String) {
          createCommunity(title: $title, desc: $desc, logo: $logo, slug: $slug, locale: $locale) {
            slug
            title
            desc
            locale
            author {
              login
            }
          }
        }
    """
  end

  def m(:update_community) do
    """
    mutation($community: String!, $title: String, $desc: String, $logo: String) {
          updateCommunity(community: $community, title: $title, desc: $desc, logo: $logo) {
            slug
            title
            desc
          }
        }
    """
  end

  def m(:request_destroy_community) do
    """
    mutation($community: String!){
      requestDestroyCommunity(community: $community) {
            slug
          }
        }
    """
  end

  def m(:subscribe_community) do
    """
    mutation($community: String!){
          subscribeCommunity(community: $community) {
            slug
          }
        }
    """
  end

  def q(:check_community_name) do
    """
    query($slug: String!) {
          checkCommunityName(slug: $slug) {
            normalizedSlug
            available
            reasonCode
          }
        }
    """
  end

  def q(:community) do
    """
    query($slug: String!, $incViews: Boolean) {
          community(slug: $slug, incViews: $incViews) {
            slug
            title
            communityTagsCount
            views
            dashboard {
              layout {
                kanbanBoards
              }
            }
          }
        }
    """
  end

  def q(:paged_communities) do
    """
    query($filter: CommunitiesFilter!) {
          pagedCommunities(filter: $filter) {
            entries {
              slug
              title
              index
              viewerHasSubscribed
              categories {
                id
                title
                slug
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

  def q(:paged_categories) do
    """
    query($filter: PagiFilter!) {
          pagedCategories(filter: $filter) {
            entries {
              id
              title
              author {
                login
                nickname
              }
              communities {
                slug
                title
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

  def q(:community_2) do
    """
    query($slug: String!) {
          community(slug: $slug, title: $title) {
            slug
            title
            desc
          }
        }
    """
  end

  def q(:community_3) do
    """
    query($slug: String!) {
          community(slug: $slug) {
            slug
            title
            desc
            dashboard {
              seo {
                ogTitle
                ogDescription
              }
              layout {
                postLayout
                kanbanBgColors
                topbarEnabled
              }
              baseInfo {
                favicon
              }

              rss {
                rssFeedType
                rssFeedCount
              }

              nameAlias {
                slug
                name
              }
            }
          }
        }
    """
  end

  def q(:community_4) do
    """
    query($slug: String!) {
          community(slug: $slug) {
            slug
            moderatorsCount
          }
        }
    """
  end

  def q(:community_5) do
    """
    query($slug: String!) {
          community(slug: $slug) {
            slug
            subscribersCount
          }
        }
    """
  end

  def q(:paged_community_subscribers) do
    """
    query($community: String!, $filter: PagiFilter!) {
          pagedCommunitySubscribers(community: $community, filter: $filter) {
            entries {
              login
              nickname
              avatar
            }
            totalCount
            totalPages
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:open_graph_info) do
    """
    query($url: String!) {
          openGraphInfo(url: $url) {
            title
            favicon
            url
            siteName
          }
        }
    """
  end

  def q(:community_6) do
    """
    query($slug: String!) {
          community(slug: $slug) {
            slug
            title
            articlesCount
            meta {
              postsCount
              changelogsCount
              docsCount
              blogsCount
            }
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

  def q(:community_tag_groups) do
    """
    query($community: String!, $thread: Thread) {
          communityTagGroups(community: $community, thread: $thread) {
            id
            title
            index
            tags {
              id
              title
              slug
              color
              thread
              group
              groupId
              index
              community {
                slug
                title
                logo
              }
              stats {
                contentsCount
                todayContentsCount
              }
            }
          }
        }
    """
  end
end
