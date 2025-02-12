defmodule GroupherServer.Test.Accounts.Published.Changelog do
  use GroupherServer.TestTools

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias Helper.ORM

  @publish_count 10

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, changelog} = db_insert(:changelog)
    {:ok, community} = db_insert(:community)
    {:ok, community2} = db_insert(:community)

    {:ok, ~m(user user2 changelog community community2)a}
  end

  describe "[publised changelogs]" do
    test "create changelog should update user published meta", ~m(community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, _} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, user} = ORM.find(User, user.id)
      assert user.meta.published_changelogs_count == 2
    end

    test "fresh user get empty paged published changelogs", ~m(user)a do
      {:ok, results} = Accounts.paged_published_articles(user, :changelog, %{page: 1, size: 20})

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == 0
    end

    test "user can get paged published changelogs", ~m(user user2 community community2)a do
      pub_changelogs =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
          {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

          acc ++ [changelog]
        end)

      pub_changelogs2 =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          changelog_attrs = mock_attrs(:changelog, %{community_id: community2.id})
          {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

          acc ++ [changelog]
        end)

      # unrelated other user
      Enum.reduce(1..5, [], fn _, acc ->
        changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
        {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user2)

        acc ++ [changelog]
      end)

      {:ok, results} = Accounts.paged_published_articles(user, :changelog, %{page: 1, size: 20})

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == @publish_count * 2

      random_changelog_id = pub_changelogs |> Enum.random() |> Map.get(:id)
      random_changelog_id2 = pub_changelogs2 |> Enum.random() |> Map.get(:id)
      assert results.entries |> Enum.any?(&(&1.id == random_changelog_id))
      assert results.entries |> Enum.any?(&(&1.id == random_changelog_id2))
    end
  end

  describe "[publised changelog comments]" do
    test "can get published article comments", ~m(changelog user)a do
      total_count = 10

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, comment} = CMS.create_comment(:changelog, changelog.id, mock_comment(), user)
        acc ++ [comment]
      end)

      filter = %{page: 1, size: 20}
      {:ok, articles} = Accounts.paged_published_comments(user, :changelog, filter)

      entries = articles.entries
      article = entries |> List.first()

      assert article.article.id == changelog.id
      assert article.article.title == changelog.title
    end
  end
end
