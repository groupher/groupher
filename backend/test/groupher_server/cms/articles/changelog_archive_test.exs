defmodule GroupherServer.Test.CMS.ChangelogArchive do
  @moduledoc false
  use GroupherServer.TestTools
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Changelog

  @now Timex.now()
  @archive_threshold get_config(:article, :archive_threshold)
  @changelog_archive_threshold Timex.shift(
                                 @now,
                                 @archive_threshold[:changelog] || @archive_threshold[:default]
                               )

  @last_week Timex.shift(@now, days: -7, seconds: -1)

  setup do
    {:ok, user} = db_insert(:user)
    # {:ok, changelog} = db_insert(:changelog)
    {:ok, community} = db_insert(:community)

    {:ok, changelog_long_ago} =
      db_insert(:changelog, %{title: "last week", inserted_at: @last_week})

    db_insert_multi(:changelog, 5)

    {:ok, ~m(user community changelog_long_ago)a}
  end

  describe "[cms changelog archive]" do
    test "can archive changelogs", ~m(changelog_long_ago)a do
      {:ok, _} = CMS.archive_articles(:changelog)

      archived_changelogs =
        Changelog
        |> where([article], article.inserted_at < ^@changelog_archive_threshold)
        |> Repo.all()

      assert length(archived_changelogs) == 1
      archived_changelog = archived_changelogs |> List.first()
      assert archived_changelog.id == changelog_long_ago.id
    end

    test "can not edit archived changelog" do
      {:ok, _} = CMS.archive_articles(:changelog)

      archived_changelogs =
        Changelog
        |> where([article], article.inserted_at < ^@changelog_archive_threshold)
        |> Repo.all()

      archived_changelog = archived_changelogs |> List.first()
      {:error, reason} = CMS.update_article(archived_changelog, %{"title" => "new title"})
      assert reason |> is_error?(:archived)
    end

    test "can not delete archived changelog" do
      {:ok, _} = CMS.archive_articles(:changelog)

      archived_changelogs =
        Changelog
        |> where([article], article.inserted_at < ^@changelog_archive_threshold)
        |> Repo.all()

      archived_changelog = archived_changelogs |> List.first()

      {:error, reason} = CMS.mark_delete_article(:changelog, archived_changelog.id)
      assert reason |> is_error?(:archived)
    end
  end
end
