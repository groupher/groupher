defmodule GroupherServer.Test.Query.PagedArticles.PagedKanbanPosts do
  @moduledoc false

  use GroupherServer.TestMate

  @article_cat Constant.CMS.article_cat()
  @article_state Constant.CMS.article_state()

  setup do
    {community, _, post_attrs, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn user community post_attrs)a}
  end

  describe "[query paged_posts filter pagination]" do
    @query """
    query($community: String!) {
      groupedKanbanPosts(community: $community) {
        backlog {
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

        rejected {
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
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.feature)
      {:ok, _} = CMS.Articles.set_state(post, @article_state.backlog)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.feature)
      {:ok, _} = CMS.Articles.set_state(post, @article_state.todo)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.bug)
      {:ok, _} = CMS.Articles.set_state(post, @article_state.wip)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.feature)
      {:ok, _} = CMS.Articles.set_state(post, @article_state.done)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.bug)
      {:ok, _} = CMS.Articles.set_state(post, @article_state.reject_dup)

      variables = %{community: community.slug}
      results = guest_conn |> gq_query(@query, variables)

      assert results["backlog"] |> is_valid_pagination?
      assert results["backlog"]["totalCount"] == 1

      assert results["todo"] |> is_valid_pagination?
      assert results["todo"]["totalCount"] == 1

      assert results["wip"] |> is_valid_pagination?
      assert results["wip"]["totalCount"] == 1

      assert results["done"] |> is_valid_pagination?
      assert results["done"]["totalCount"] == 1

      assert results["rejected"] |> is_valid_pagination?
      assert results["rejected"]["totalCount"] == 1
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
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.feature)
      {:ok, _} = CMS.Articles.set_state(post, @article_state.todo)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.bug)
      {:ok, _} = CMS.Articles.set_state(post, @article_state.wip)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.feature)
      {:ok, _} = CMS.Articles.set_state(post, @article_state.done)

      variables = %{
        community: community.slug,
        filter: %{page: 1, size: 20, state: "WIP"}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == 1
      assert results["entries"] |> Enum.at(0) |> Map.get("state") == "WIP"
    end
  end
end
