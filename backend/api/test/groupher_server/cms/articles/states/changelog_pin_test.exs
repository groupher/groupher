defmodule GroupherServer.Test.CMS.Articles.ChangelogPin do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Articles.ErrorCat
  alias CMS.Model.{ArticleCommunity, PinnedArticle}

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, changelog} =
      CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)

    {:ok, ~m(user community changelog)a}
  end

  describe "[cms changelog pin]" do
    test "can pin a changelog", ~m(community changelog user)a do
      {:ok, _} = CMS.Articles.pin(community, changelog.id, user)

      relation =
        Repo.get_by!(ArticleCommunity, article_id: changelog.id, community_id: community.id)

      {:ok, pinned_article} =
        ORM.find_by(PinnedArticle, %{article_community_id: relation.id})

      assert pinned_article.article_community_id == relation.id
    end

    test "one community & thread can only pin certain count of changelog", ~m(community user)a do
      Enum.reduce(1..@max_pinned_article_count_per_thread, [], fn _, acc ->
        {:ok, new_changelog} =
          CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)

        {:ok, _} = CMS.Articles.pin(community, new_changelog.id, user)
        acc
      end)

      {:ok, new_changelog} =
        CMS.Articles.create(community, :changelog, mock_attrs(:changelog), user)

      {:error, reason} = CMS.Articles.pin(community, new_changelog.id, user)

      assert error_code(reason) ==
               ErrorCat.code(ErrorCat.too_much_pinned_article())
    end

    test "can undo pin to a changelog", ~m(community changelog user)a do
      {:ok, _} = CMS.Articles.pin(community, changelog.id, user)

      relation =
        Repo.get_by!(ArticleCommunity, article_id: changelog.id, community_id: community.id)

      assert {:ok, _unpinned} = CMS.Articles.undo_pin(community, changelog.id, user)

      assert {:error, _} = ORM.find_by(PinnedArticle, %{article_community_id: relation.id})
    end
  end
end
