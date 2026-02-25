defmodule GroupherServer.Test.Accounts.Publish.Changelog do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.Accounts.Publish, as: Accounts

  @publish_count 10

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    {:ok, user2} = db_insert(:user)
    {:ok, community2} = db_insert(:community)

    {:ok, ~m(user user2 changelog community community2)a}
  end

  describe "[published changelogs]" do
    test "create changelog should update user published meta", ~m(community user2)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, _} = CMS.Articles.create(community, :changelog, changelog_attrs, user2)
      {:ok, _} = CMS.Articles.create(community, :changelog, changelog_attrs, user2)

      {:ok, user} = ORM.find(User, user2.id)
      assert user.meta.published_changelogs_count == 2
    end

    test "fresh user get empty paged published changelogs", ~m(user2)a do
      {:ok, results} = Accounts.paged_articles(user2, :changelog, %{page: 1, size: 20})

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == 0
    end

    test "user can get paged published changelogs", ~m(user user2 community community2)a do
      pub_changelogs =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
          {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

          acc ++ [changelog]
        end)

      pub_changelogs2 =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          changelog_attrs = mock_attrs(:changelog, %{community_id: community2.id})
          {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

          acc ++ [changelog]
        end)

      # unrelated other user
      Enum.reduce(1..5, [], fn _, acc ->
        changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
        {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user2)

        acc ++ [changelog]
      end)

      {:ok, results} = Accounts.paged_articles(user, :changelog, %{page: 1, size: 30})

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == @publish_count * 2 + 1

      random_changelog_id = pub_changelogs |> Enum.random() |> Map.get(:id)
      random_changelog_id2 = pub_changelogs2 |> Enum.random() |> Map.get(:id)
      assert results.entries |> Enum.any?(&(&1.id == random_changelog_id))
      assert results.entries |> Enum.any?(&(&1.id == random_changelog_id2))
    end
  end

  describe "[published changelog comments]" do
    test "can get published article comments", ~m(community changelog user)a do
      total_count = 10

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, comment} =
          CMS.Comments.create_comment(community, :changelog, changelog.inner_id, mock_comment(), user)

        acc ++ [comment]
      end)

      filter = %{page: 1, size: 20}
      {:ok, articles} = Accounts.paged_comments(user, :changelog, filter)

      entries = articles.entries
      article = entries |> List.first()

      assert article.article.id == changelog.id
      assert article.article.title == changelog.title
    end
  end
end
