defmodule GroupherServer.Test.Accounts.CollectFolders.Pagi do
  use GroupherServer.TestMate, async: false

  alias Accounts.CollectFolders
  alias GroupherServer.CMS
  alias CMS.Model.{Article, ArticleLifecycle, ArticleReviewBlock}
  alias Helper.ORM.Pagi.{Page}
  alias GroupherServer.{Pagi, Repo}
  alias Pagi.Params

  test "folder pages exclude Articles restricted by their Lifecycle review facts" do
    {:ok, user} = db_insert(:user)
    {:ok, folder} = CollectFolders.create(%{title: "review-aware collection"}, user)
    posts = for _ <- 1..3, do: elem(db_insert(:post), 1)
    for post <- posts, do: CollectFolders.add(post, folder.id, user)

    hidden = hd(posts)
    article = Repo.get!(Article, hidden.article_id)
    _lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)

    assert {:ok, %ArticleReviewBlock{}} =
             Repo.transaction(fn ->
               with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(locked, %{
                        scope_key: "platform",
                        type: :manual_hold,
                        source_ref: "collect-folder-test:restricted",
                        source: :human,
                        applied_at: DateTime.utc_now(:second)
                      }) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert {:ok, %Page.Offset{entries: entries, total_count: 2}} =
             CollectFolders.paged_articles(
               folder.id,
               %{},
               %Params.Offset{page: 1, size: 100},
               user
             )

    refute Enum.any?(entries, &(&1.id == article.id))
  end

  test "folder entry cursors follow collection order and recheck privacy" do
    {:ok, user} = db_insert(:user)
    {:ok, stranger} = db_insert(:user)
    {:ok, folder} = CollectFolders.create(%{title: "cursor collection", private: true}, user)
    {:ok, other} = CollectFolders.create(%{title: "other"}, user)
    posts = for _ <- 1..4, do: elem(db_insert(:post), 1)
    for post <- Enum.reverse(posts), do: CollectFolders.add(post, folder.id, user)

    assert {:ok, %Page.Offset{entries: expected, total_count: 4}} =
             CollectFolders.paged_articles(
               folder.id,
               %{},
               %Params.Offset{page: 1, size: 100},
               user
             )

    assert {:ok, %Page.Cursor{entries: first, end_cursor: cursor}} =
             CollectFolders.paged_articles(folder.id, %{}, %Params.Cursor{first: 2}, user)

    assert {:ok, %Page.Cursor{entries: rest, has_next_page: false}} =
             CollectFolders.paged_articles(
               folder.id,
               %{},
               %Params.Cursor{first: 100, after: cursor},
               user
             )

    assert Enum.map(first ++ rest, &{&1.community.slug, &1.thread, &1.inner_id}) ==
             Enum.map(expected, &{&1.community.slug, &1.thread, &1.inner_id})

    assert {:error, _} =
             CollectFolders.paged_articles(
               folder.id,
               %{},
               %Params.Cursor{first: 2, after: cursor},
               stranger
             )

    assert {:error, _} =
             CollectFolders.paged_articles(
               other.id,
               %{},
               %Params.Cursor{first: 2, after: cursor},
               user
             )

    for post <- posts, do: CMS.Interactions.upvote(post, user, Ecto.UUID.generate())

    assert {:ok, %Page.Offset{entries: expected}} =
             Accounts.Upvotes.paged_articles(user, %{}, %Params.Offset{page: 1, size: 100})

    assert {:ok, %Page.Cursor{entries: first, end_cursor: cursor}} =
             Accounts.Upvotes.paged_articles(user, %{}, %Params.Cursor{first: 2})

    assert {:ok, %Page.Cursor{entries: rest, has_next_page: false}} =
             Accounts.Upvotes.paged_articles(user, %{}, %Params.Cursor{first: 100, after: cursor})

    assert Enum.map(first ++ rest, &{&1.community.slug, &1.thread, &1.inner_id}) ==
             Enum.map(expected, &{&1.community.slug, &1.thread, &1.inner_id})
  end
end
