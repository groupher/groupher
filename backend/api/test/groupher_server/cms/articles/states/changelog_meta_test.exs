defmodule GroupherServer.Test.CMS.ChangelogMeta do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    {:ok, ~m(user community changelog_attrs)a}
  end

  describe "[cms changelog meta info]" do
    test "can get default meta info", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      changelog = Repo.get!(CMS.Model.Article, changelog.id)
      refute changelog.is_edited
      refute changelog.comments_locked
    end

    test "is_edited flag should set to true after changelog updated",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert not Repo.get!(CMS.Model.Article, changelog.id).is_edited

      {:ok, draft} =
        CMS.Articles.update(
          changelog,
          %{"title" => "new title", expected_version: changelog.version},
          user,
          Ecto.UUID.generate()
        )

      assert draft.title == "new title"
      assert Repo.get!(CMS.Model.Article, changelog.id).is_edited
    end

    test "changelog's lock/undo_lock article should work", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert not changelog.meta.is_comment_locked

      {:ok, _} = CMS.Articles.lock_comments(changelog.id, user, community: community)
      assert Repo.get!(CMS.Model.Article, changelog.id).comments_locked

      {:ok, _} = CMS.Articles.undo_lock_comments(changelog.id, user, community: community)
      refute Repo.get!(CMS.Model.Article, changelog.id).comments_locked
    end
  end
end
