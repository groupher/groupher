defmodule GroupherServer.Test.CMS.Articles.ReviewBlocksTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticleReviewBlock,
    DocBranch,
    DocLifecycle,
    DocPublic
  }

  alias CMS.Outbox.Event, as: OutboxEvent

  test "ending one scope restriction keeps other scope restrictions effective" do
    {community, article_view, _attrs, author} = mock_article(:post)
    article = Repo.get!(Article, article_view.id)
    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    operation_ref = Ecto.UUID.generate()

    assert {:ok, community_restriction} =
             Repo.transaction(fn ->
               with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(
                        locked,
                        attrs(lifecycle, "community:#{community.id}", "community-rule")
                      ) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    refute public_binding?(article.thread, binding.id)
    assert public_binding?(article.thread, binding.id, author)
    assert {:ok, []} = CMS.ArticleStats.read_public(community.slug, :post, [binding.inner_id])

    assert {:ok, platform_restriction} =
             Repo.transaction(fn ->
               with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(
                        locked,
                        attrs(lifecycle, "platform", "platform-rule")
                      ) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    refute public_binding?(article.thread, binding.id)
    assert public_binding?(article.thread, binding.id, author)

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article) do
                 CMS.Articles.Lifecycle.end_review_blocks(
                   locked,
                   "community:#{community.id}",
                   [community_restriction.id],
                   operation_ref,
                   "review_approved"
                 )
               end
             end)

    refute public_binding?(article.thread, binding.id)
    assert public_binding?(article.thread, binding.id, author)

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article) do
                 CMS.Articles.Lifecycle.end_review_blocks(
                   locked,
                   "platform",
                   [platform_restriction.id],
                   operation_ref,
                   "review_approved"
                 )
               end
             end)

    assert public_binding?(article.thread, binding.id)

    assert {:ok, [_stats]} =
             CMS.ArticleStats.read_public(community.slug, :post, [binding.inner_id])
  end

  test "replaying the same active restriction does not create another row" do
    {community, article_view, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, article_view.id)
    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)
    restriction_attrs = attrs(lifecycle, "platform", "case:stable")

    apply = fn ->
      Repo.transaction(fn ->
        with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article),
             {:ok, restriction} <-
               CMS.Articles.Lifecycle.apply_review_block(locked, restriction_attrs) do
          restriction
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end

    assert {:ok, first} = apply.()
    assert {:ok, replay} = apply.()
    assert first.id == replay.id

    assert Repo.aggregate(
             from(restriction in ArticleReviewBlock,
               where: restriction.article_id == ^article.id and is_nil(restriction.community_id)
             ),
             :count
           ) == 1

    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    refute public_binding?(article.thread, binding.id)
  end

  test "visibility transitions remove and restore the binding-scoped search entry" do
    {community, article_view, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, article_view.id)
    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)
    search_ref = CMS.SearchArtiments.Artiment.article_key(:post, article.id, community.slug)

    assert {:ok, :pass} = CMS.SearchArtiments.Indexer.upsert_article(:post, article.id)
    assert :ets.lookup(:search_artiments_test_platform, search_ref) != []

    assert {:ok, restriction} =
             Repo.transaction(fn ->
               with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(
                        locked,
                        attrs(lifecycle, "community:#{community.id}", "search-hidden")
                      ) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert {:ok, :pass} =
             CMS.SearchArtiments.Indexer.sync_binding(:post, article.id, community.id)

    assert :ets.lookup(:search_artiments_test_platform, search_ref) == []

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article) do
                 CMS.Articles.Lifecycle.end_review_blocks(
                   locked,
                   "community:#{community.id}",
                   [restriction.id],
                   Ecto.UUID.generate(),
                   "search-restored"
                 )
               end
             end)

    assert {:ok, :pass} =
             CMS.SearchArtiments.Indexer.sync_binding(:post, article.id, community.id)

    assert :ets.lookup(:search_artiments_test_platform, search_ref) != []
  end

  test "rejects a community restriction outside the Article's bindings" do
    {community, article_view, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, article_view.id)
    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)
    attrs = attrs(lifecycle, "community:#{community.id + 1000}", "unbound-community")

    assert {:ok, {:error, %ErrorCat.Error{reason: :invalid_review_block}}} =
             Repo.transaction(fn ->
               with {:ok, locked} <- CMS.Articles.Lifecycle.lock(article) do
                 CMS.Articles.Lifecycle.apply_review_block(locked, attrs)
               end
             end)
  end

  test "a Doc restriction changes only the selected branch public projection" do
    {_community, article_view, _attrs, _author} = mock_article(:doc)
    article = Repo.get!(Article, article_view.id)
    branch = Repo.get_by!(DocBranch, type: :main, community_id: article_view.community.id)
    lifecycle = Repo.get_by!(DocLifecycle, article_id: article.id, branch_id: branch.id)

    lock_lifecycle = fn ->
      DocLifecycle
      |> where([row], row.id == ^lifecycle.id)
      |> lock("FOR UPDATE")
      |> Repo.one()
    end

    assert {:ok, restriction} =
             Repo.transaction(fn ->
               locked = lock_lifecycle.()

               case CMS.Docs.Lifecycle.apply_review_block(
                      locked,
                      attrs(lifecycle, "platform", "doc-review")
                    ) do
                 {:ok, restriction} -> restriction
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    assert Repo.get_by!(DocPublic, article_id: article.id, branch_id: branch.id).visible == false

    assert %OutboxEvent{data: data} =
             Repo.get_by!(OutboxEvent,
               event: "article.visibility_changed",
               resource_id: article.id
             )

    assert data["branch_id"] == branch.id
    assert data["thread"] == "doc"
    assert data["community_id"] == article_view.community.id

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               locked = lock_lifecycle.()

               CMS.Docs.Lifecycle.end_review_blocks(
                 locked,
                 "platform",
                 [restriction.id],
                 Ecto.UUID.generate(),
                 "review_approved"
               )
             end)

    assert Repo.get_by!(DocPublic, article_id: article.id, branch_id: branch.id).visible

    binding =
      Repo.get_by!(ArticleBinding,
        article_id: article.id,
        community_id: article_view.community.id
      )

    assert public_binding?(:doc, binding.id)
  end

  defp public_binding?(thread, binding_id, actor \\ nil) do
    public_bindings = CMS.Articles.Pagination.public_binding_ids(thread, actor)

    Repo.exists?(
      from(binding in ArticleBinding,
        where: binding.id == ^binding_id and binding.id in subquery(public_bindings)
      )
    )
  end

  defp attrs(_lifecycle, scope_key, source_ref) do
    %{
      scope_key: scope_key,
      type: :manual_hold,
      source_ref: source_ref,
      source: :human,
      applied_at: DateTime.utc_now(:second)
    }
  end
end
