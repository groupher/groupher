defmodule GroupherServer.Test.CMS.ChangelogPendingFlag do
  @moduledoc false

  use GroupherServer.TestMate

  @total_count 35

  @audit_legal Constant.CMS.pending(:legal)
  @audit_illegal Constant.CMS.pending(:illegal)

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
        CMS.Articles.read(changelog_m.community_slug, :changelog, changelog_m.inner_id)

      {:ok, _} =
        CMS.Articles.set_illegal(:changelog, changelog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, changelog_m} = ORM.find(Changelog, changelog_m.id)
      assert changelog_m.pending == @audit_illegal

      {:error, reason} =
        CMS.Articles.read(changelog_m.community_slug, :changelog, changelog_m.inner_id)

      assert reason |> is_error?(:pending)
    end

    test "author can read it's own pending changelog", ~m(community user)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      {:ok, _} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id)

      {:ok, _} =
        CMS.Articles.set_illegal(:changelog, changelog.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, changelog_read} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user)

      assert changelog_read.id == changelog.id

      {:ok, user2} = db_insert(:user)

      {:error, reason} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user2)

      assert reason |> is_error?(:pending)
    end

    test "pending changelog can set/unset pending", ~m(changelog_m)a do
      {:ok, _} =
        CMS.Articles.read(changelog_m.community_slug, :changelog, changelog_m.inner_id)

      {:ok, _} =
        CMS.Articles.set_illegal(:changelog, changelog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"]
        })

      {:ok, changelog_m} = ORM.find(Changelog, changelog_m.id)
      assert changelog_m.pending == @audit_illegal

      {:ok, _} = CMS.Articles.unset_illegal(:changelog, changelog_m.id, %{})

      {:ok, changelog_m} = ORM.find(Changelog, changelog_m.id)
      assert changelog_m.pending == @audit_legal

      {:ok, _} =
        CMS.Articles.read(changelog_m.community_slug, :changelog, changelog_m.inner_id)
    end

    test "pending changelog's meta should have info", ~m(changelog_m)a do
      {:ok, _} =
        CMS.Articles.read(changelog_m.community_slug, :changelog, changelog_m.inner_id)

      {:ok, _} =
        CMS.Articles.set_illegal(:changelog, changelog_m.id, %{
          is_legal: false,
          illegal_reason: ["some-reason"],
          illegal_words: ["some-word"],
          illegal_articles: ["/changelog/#{changelog_m.id}"]
        })

      {:ok, changelog_m} = ORM.find(Changelog, changelog_m.id)
      assert changelog_m.pending == @audit_illegal
      assert not changelog_m.meta.is_legal
      assert changelog_m.meta.illegal_reason == ["some-reason"]
      assert changelog_m.meta.illegal_words == ["some-word"]

      changelog_m = Repo.preload(changelog_m, :author)
      {:ok, user} = ORM.find(User, changelog_m.author.user_id)
      assert user.meta.has_illegal_articles
      assert user.meta.illegal_articles == ["/changelog/#{changelog_m.id}"]

      {:ok, _} =
        CMS.Articles.unset_illegal(:changelog, changelog_m.id, %{
          is_legal: true,
          illegal_reason: [],
          illegal_words: [],
          illegal_articles: ["/changelog/#{changelog_m.id}"]
        })

      {:ok, changelog_m} = ORM.find(Changelog, changelog_m.id)
      assert changelog_m.pending == @audit_legal
      assert changelog_m.meta.is_legal
      assert changelog_m.meta.illegal_reason == []
      assert changelog_m.meta.illegal_words == []

      changelog_m = Repo.preload(changelog_m, :author)
      {:ok, user} = ORM.find(User, changelog_m.author.user_id)
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
