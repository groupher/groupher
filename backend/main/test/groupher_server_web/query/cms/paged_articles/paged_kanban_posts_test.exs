defmodule GroupherServer.Test.Query.PagedArticles.PagedKanbanPosts do
  @moduledoc false

  use GroupherServer.TestTools

  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS
  alias Helper.Constant

  @article_cat Constant.CMS.article_cat()
  @article_state Constant.CMS.article_state()

  @page_size get_config(:general, :page_size)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    post_attrs = mock_attrs(:post, %{community_id: community.id})

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn user community post_attrs)a}
  end

  describe "[query paged_posts filter pagination]" do
    @query """
    query($community: String!) {
      groupedKanbanPosts(community: $community) {
        todo {
          entries {
            innerId
            cat
            state
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
            state
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
            state
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
    test "should get grouped paged posts", ~m(guest_conn user community post_attrs)a do
      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)

      {:ok, _} = CMS.set_post_cat(post, @article_cat.feature)
      {:ok, _} = CMS.set_post_state(post, @article_state.todo)

      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, _} = CMS.set_post_cat(post, @article_cat.bug)
      {:ok, _} = CMS.set_post_state(post, @article_state.wip)

      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, _} = CMS.set_post_cat(post, @article_cat.feature)
      {:ok, _} = CMS.set_post_state(post, @article_state.done)

      variables = %{community: community.slug}
      results = guest_conn |> query_result(@query, variables, "groupedKanbanPosts")

      assert results["todo"] |> is_valid_pagination?
      assert results["todo"]["totalCount"] == 1

      assert results["wip"] |> is_valid_pagination?
      assert results["wip"]["totalCount"] == 1

      assert results["done"] |> is_valid_pagination?
      assert results["done"]["totalCount"] == 1
    end

    @query """
    query($community: String!, $filter: PagedKanbanPostsFilter!) {
      pagedKanbanPosts(community: $community, filter: $filter) {
        entries {
          innerId
          cat
          state
          title
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "can get paged kanban posts", ~m(guest_conn user community post_attrs)a do
      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, _} = CMS.set_post_cat(post, @article_cat.feature)
      {:ok, _} = CMS.set_post_state(post, @article_state.todo)

      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, _} = CMS.set_post_cat(post, @article_cat.bug)
      {:ok, _} = CMS.set_post_state(post, @article_state.wip)

      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, _} = CMS.set_post_cat(post, @article_cat.feature)
      {:ok, _} = CMS.set_post_state(post, @article_state.done)

      variables = %{
        community: community.slug,
        filter: %{page: 1, size: 20, state: "WIP"}
      }

      results = guest_conn |> query_result(@query, variables, "pagedKanbanPosts")

      assert results["totalCount"] == 1
      assert results["entries"] |> Enum.at(0) |> Map.get("state") == "WIP"
    end
  end
end
