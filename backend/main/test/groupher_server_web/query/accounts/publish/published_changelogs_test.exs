defmodule GroupherServer.Test.Query.Accounts.Publish.Changelogs do
  @moduledoc false

  use GroupherServer.TestTools

  @publish_count 10

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(guest_conn user_conn community changelog user)a}
  end

  describe "[published changelogs]" do
    test "can get published changelogs", ~m(guest_conn community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      {:ok, changelog2} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      variables = %{login: user.login, filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_published_articles, :changelog), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(changelog.inner_id)))
      assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(changelog2.inner_id)))
    end
  end

  describe "[account published comments on changelog]" do
    test "user can get paged published comments on changelog",
         ~m(guest_conn user community changelog)a do
      pub_comments =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          {:ok, comment} =
            CMS.Comments.create_comment(community, :changelog, changelog.inner_id, mock_comment(), user)

          acc ++ [comment]
        end)

      random_comment_id = pub_comments |> Enum.random() |> Map.get(:id) |> to_string

      variables = %{login: user.login, thread: "CHANGELOG", filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_published_comments), variables)

      entries = results["entries"]
      assert results |> is_valid_pagination?
      assert results["totalCount"] == @publish_count

      assert entries |> Enum.all?(&(not is_nil(&1["article"]["author"])))

      assert entries |> Enum.all?(&(&1["article"]["id"] == to_string(changelog.id)))
      assert entries |> Enum.all?(&(&1["author"]["id"] == to_string(user.id)))
      assert entries |> Enum.any?(&(&1["id"] == random_comment_id))
    end
  end
end
