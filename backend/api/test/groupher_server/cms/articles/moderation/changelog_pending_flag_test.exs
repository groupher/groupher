defmodule GroupherServer.Test.CMS.ChangelogPendingFlag do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS

  @total_count 35

  setup do
    {:ok, user} = db_insert(:user)

    {:ok, community} = mock_community(user)
    {:ok, community2} = mock_community(user)

    {_, _, _, _} = mock_article(:changelog, community2, user)

    changelogs =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} =
          CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)

        acc ++ [value]
      end)

    changelog_b = changelogs |> List.first()
    changelog_m = changelogs |> Enum.at(div(@total_count, 2))
    changelog_e = changelogs |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user changelog_b changelog_m changelog_e)a}
  end

  describe "[pending changelogs flags]" do
    test "pending changelog can not be read", ~m(changelog_m)a do
      {:ok, _} =
        read_article(
          article_community(changelog_m),
          :changelog,
          changelog_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          changelog_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations
        )

      stable = Repo.get!(CMS.Model.Article, changelog_m.article_id)
      assert stable.moderation_state == :illegal

      {:error, reason} =
        read_article(
          article_community(changelog_m),
          :changelog,
          changelog_m.inner_id
        )

      assert reason |> is_error?({{:cms, :article}, :pending})
    end

    test "author can read it's own pending changelog", ~m(community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      {:ok, _} =
        read_article(
          article_community(changelog),
          :changelog,
          changelog.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          changelog.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations
        )

      {:ok, changelog_read} =
        read_article(
          article_community(changelog),
          :changelog,
          changelog.inner_id,
          user
        )

      assert changelog_read.id == changelog.id

      {:ok, user2} = db_insert(:user)

      {:error, reason} =
        read_article(
          article_community(changelog),
          :changelog,
          changelog.inner_id,
          user2
        )

      assert reason |> is_error?({{:cms, :article}, :pending})
    end

    test "pending changelog can set/unset pending", ~m(changelog_m)a do
      {:ok, _} =
        read_article(
          article_community(changelog_m),
          :changelog,
          changelog_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          changelog_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations
        )

      stable = Repo.get!(CMS.Model.Article, changelog_m.article_id)
      assert stable.moderation_state == :illegal

      {:ok, _} = CMS.Articles.unset_illegal(changelog_m.article_id, %{}, :operations)

      stable = Repo.get!(CMS.Model.Article, changelog_m.article_id)
      assert stable.moderation_state == :legal

      {:ok, _} =
        read_article(
          article_community(changelog_m),
          :changelog,
          changelog_m.inner_id
        )
    end

    test "pending changelog's meta should have info", ~m(changelog_m)a do
      {:ok, _} =
        read_article(
          article_community(changelog_m),
          :changelog,
          changelog_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          changelog_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"],
            illegal_articles: ["/changelog/#{changelog_m.id}"]
          },
          :operations
        )

      stable = Repo.get!(CMS.Model.Article, changelog_m.article_id)
      assert stable.moderation_state == :illegal
      assert stable.illegal_reason == ["some-reason"]
      assert stable.illegal_words == ["some-word"]

      stable = Repo.preload(stable, author: :user)
      user = stable.author.user
      assert user.meta.has_illegal_articles
      assert user.meta.illegal_articles == ["/changelog/#{changelog_m.id}"]

      {:ok, _} =
        CMS.Articles.unset_illegal(
          changelog_m.article_id,
          %{
            is_legal: true,
            illegal_reason: [],
            illegal_words: [],
            illegal_articles: ["/changelog/#{changelog_m.id}"]
          },
          :operations
        )

      stable = Repo.get!(CMS.Model.Article, changelog_m.article_id)
      assert stable.moderation_state == :legal
      assert stable.illegal_reason == []
      assert stable.illegal_words == []

      stable = Repo.preload(stable, author: :user)
      user = stable.author.user
      assert not user.meta.has_illegal_articles
      assert user.meta.illegal_articles == []
    end
  end

  # alias CMS.Delegate.Hooks

  # test "can audit paged audit failed changelogs", ~m(changelog_m)a do
  #   {:ok, changelog} = ORM.find(Changelog, changelog_m.id)

  #   {:ok, changelog} = CMS.set_article_audit_failed(changelog, %{})

  #   {:ok, result} = CMS.paged_audit_failed_articles(:changelog, %{page: 1, size: 20})
  #   assert result |> is_valid_pagination?(:raw)
  #   assert result.total_count == 1

  #   Enum.map(result.entries, fn changelog ->
  #     Hooks.Audition.handle(changelog)
  #   end)

  #   {:ok, result} = CMS.paged_audit_failed_articles(:changelog, %{page: 1, size: 20})
  #   assert result.total_count == 0
  # end
end
