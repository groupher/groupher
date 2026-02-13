defmodule GroupherServer.Test.CMS.Articles.ChangelogPin do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.PinnedArticle

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

    {:ok, ~m(user community changelog)a}
  end

  describe "[cms changelog pin]" do
    test "can pin a changelog", ~m(community changelog)a do
      {:ok, _} = CMS.pin_article(community, changelog)
      {:ok, pinned_article} = ORM.find_by(PinnedArticle, %{changelog_id: changelog.id})

      assert pinned_article.changelog_id == changelog.id
    end

    test "one community & thread can only pin certain count of changelog", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_changelog} =
          CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

        {:ok, _} = CMS.pin_article(community, new_changelog)
        acc
      end)

      {:ok, new_changelog} =
        CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      {:error, reason} = CMS.pin_article(community, new_changelog)
      assert error_code(reason) == ecode(:too_much_pinned_article)
    end

    test "can undo pin to a changelog", ~m(community changelog)a do
      {:ok, _} = CMS.pin_article(community, changelog)

      assert {:ok, _unpinned} = CMS.undo_pin_article(community, changelog)

      assert {:error, _} = ORM.find_by(PinnedArticle, %{changelog_id: changelog.id})
    end
  end
end
