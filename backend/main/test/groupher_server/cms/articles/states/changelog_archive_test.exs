defmodule GroupherServer.Test.CMS.ChangelogArchive do
  @moduledoc false

  use GroupherServer.TestMate

  @archive_threshold get_config(:article, :archive_threshold)
  @changelog_archive_threshold Datetime.shift(
                                 @now,
                                 @archive_threshold[:changelog] || @archive_threshold[:default]
                               )

  setup do
    {:ok, user} = db_insert(:user)
    # {:ok, changelog} = db_insert(:changelog)
    community_attrs = mock_attrs(:community)
    {:ok, community} = CMS.Communities.create(community_attrs, user)

    {:ok, changelog_long_ago} =
      db_insert(:changelog, %{title: "last week", inserted_at: @last_year})

    db_insert_multi(:changelog, 5)

    {:ok, ~m(user community changelog_long_ago)a}
  end

  describe "[cms changelog archive]" do
    test "can archive changelogs", ~m(changelog_long_ago)a do
      {:ok, _} = CMS.Articles.archive(:changelog)

      archived_changelogs =
        Changelog
        |> where([article], article.inserted_at < ^@changelog_archive_threshold)
        |> Repo.all()

      assert length(archived_changelogs) == 1
      archived_changelog = archived_changelogs |> List.first()
      assert archived_changelog.id == changelog_long_ago.id
    end

    test "can not edit archived changelog" do
      {:ok, _} = CMS.Articles.archive(:changelog)

      archived_changelogs =
        Changelog
        |> where([article], article.inserted_at < ^@changelog_archive_threshold)
        |> Repo.all()

      archived_changelog = archived_changelogs |> List.first()
      {:error, reason} = CMS.Articles.update(archived_changelog, %{"title" => "new title"})
      assert reason |> is_error?(:archived)
    end

    test "can not delete archived changelog" do
      {:ok, _} = CMS.Articles.archive(:changelog)

      archived_changelogs =
        Changelog
        |> where([article], article.inserted_at < ^@changelog_archive_threshold)
        |> Repo.all()

      archived_changelog = archived_changelogs |> List.first()

      {:error, reason} = CMS.Articles.mark_delete(archived_changelog)
      assert reason |> is_error?(:archived)
    end
  end
end
