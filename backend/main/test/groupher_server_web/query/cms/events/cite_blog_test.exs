defmodule GroupherServer.Test.Query.Events.BlogCiting do
  @moduledoc false

  use GroupherServer.TestTools, async: false

  alias CMS.Events

  @site_host get_config(:general, :site_host)

  setup do
    {community, blog, blog_attrs, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community blog blog_attrs user)a}
  end

  describe "[query paged_blogs filter pagination]" do
    @query """
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
    test "should get paged cittings", ~m(guest_conn community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      {:ok, blog2} = CMS.Articles.create(community, :blog, blog_attrs, user)

      body = mock_comment(~s(the <a href=#{@site_host}/blog/#{blog2.id} />))
      {:ok, comment} = CMS.Comments.create_comment(community, :blog, blog2.inner_id, body, user)

      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/blog/#{blog2.id} />),
          ~s(the <a href=#{@site_host}/blog/#{blog2.id} />)
        )

      blog_attrs = blog_attrs |> Map.merge(%{body: body})
      {:ok, blog_x} = CMS.Articles.create(community, :blog, blog_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/blog/#{blog2.id} />))
      blog_attrs = blog_attrs |> Map.merge(%{body: body})
      {:ok, blog_y} = CMS.Articles.create(community, :blog, blog_attrs, user)

      Events.emit(:cite, %{artiment: blog_x})
      Events.emit(:cite, %{artiment: comment})
      Events.emit(:cite, %{artiment: blog_y})

      variables = %{content: "BLOG", id: blog2.id, filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 3
    end
  end
end
