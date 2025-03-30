defmodule GroupherServer.Test.Query.Hooks.ChangelogCiting do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Delegate.Hooks

  @site_host get_config(:general, :site_host)

  setup do
    {community, changelog, changelog_attrs, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community changelog changelog_attrs user)a}
  end

  describe "[query paged_changelogs filter pagination]" do
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
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog2} = CMS.create_article(community, :changelog, changelog_attrs, user)

      body = mock_comment(~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />))
      {:ok, comment} = CMS.create_comment(community, :changelog, changelog2.inner_id, body, user)

      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />),
          ~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />)
        )

      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})
      {:ok, changelog_x} = CMS.create_article(community, :changelog, changelog_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />))
      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})
      {:ok, changelog_y} = CMS.create_article(community, :changelog, changelog_attrs, user)

      Hooks.Cite.handle(changelog_x)
      Hooks.Cite.handle(comment)
      Hooks.Cite.handle(changelog_y)

      variables = %{content: "CHANGELOG", id: changelog2.id, filter: %{page: 1, size: 10}}
      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 3
    end
  end
end
