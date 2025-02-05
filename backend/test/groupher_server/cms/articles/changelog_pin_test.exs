defmodule GroupherServer.Test.CMS.Artilces.ChangelogPin do
  @moduledoc false

  use GroupherServer.TestTools

  alias Helper.ORM
  alias GroupherServer.CMS

  alias CMS.Model.{Community, PinnedArticle}

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

    {:ok, ~m(user community changelog)a}
  end

  describe "[cms changelog pin]" do
    test "can pin a changelog", ~m(community changelog)a do
      {:ok, _} = CMS.pin_article(:changelog, changelog.id, community.id)
      {:ok, pind_article} = ORM.find_by(PinnedArticle, %{changelog_id: changelog.id})

      assert pind_article.changelog_id == changelog.id
    end

    test "one community & thread can only pin certern count of changelog", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_changelog} =
          CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

        {:ok, _} = CMS.pin_article(:changelog, new_changelog.id, community.id)
        acc
      end)

      {:ok, new_changelog} =
        CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      {:error, reason} = CMS.pin_article(:changelog, new_changelog.id, community.id)
      assert reason |> Keyword.get(:code) == ecode(:too_much_pinned_article)
    end

    test "can not pin a non-exsit changelog", ~m(community)a do
      assert {:error, _} = CMS.pin_article(:changelog, 8848, community.id)
    end

    test "can undo pin to a changelog", ~m(community changelog)a do
      {:ok, _} = CMS.pin_article(:changelog, changelog.id, community.id)

      assert {:ok, _unpinned} = CMS.undo_pin_article(:changelog, changelog.id, community.id)

      assert {:error, _} = ORM.find_by(PinnedArticle, %{changelog_id: changelog.id})
    end
  end
end
