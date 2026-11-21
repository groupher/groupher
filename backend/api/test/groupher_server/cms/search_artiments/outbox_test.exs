defmodule GroupherServer.Test.CMS.SearchArtiments.OutboxTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false
  alias GroupherServer.CMS

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    ArticleSnapshotPost,
    ArticleWorkingCopy
  }

  alias CMS.Outbox.Event
  alias CMS.SearchArtiments.{Indexer, Query}
  alias Helper.TestFakes.SearchArtiments, as: SearchPlatform

  setup do
    SearchPlatform.reset()
    :ok
  end

  test "explicit disabled provider drains indexing without publishing search records" do
    {source, article, _attrs, _user} = mock_article(:post)
    original = Application.fetch_env!(:groupher_server, :search_artiments)

    on_exit(fn -> Application.put_env(:groupher_server, :search_artiments, original) end)

    Application.put_env(
      :groupher_server,
      :search_artiments,
      Keyword.put(original, :platform, CMS.SearchArtiments.Disabled)
    )

    event = enqueue("article.updated", source, article)
    assert {:ok, :pass} = deliver(event)
    assert Repo.get!(Event, event.id).status == :done
    assert entries(article) == []
    assert {:error, _} = CMS.SearchArtiments.search(%Query{text: article.title})
    assert {:ok, :pass} = CMS.SearchArtiments.delete([article.id])
    assert {:ok, :pass} = CMS.SearchArtiments.update_metrics([{article.id, %{}}])

    # A disabled external sink must not resolve a Community that has since gone.
    delayed = enqueue("article.visibility_changed", %{source | id: -1}, article)
    assert {:ok, :pass} = deliver(delayed)
    assert Repo.get!(Event, delayed.id).status == :done
  end

  test "published and updated children refresh every public mirror" do
    {source, article, _attrs, _user} = mock_article(:post)
    {:ok, mirror} = db_insert(:community)

    Repo.insert!(
      ArticleBinding.changeset(%ArticleBinding{}, %{
        article_id: article.id,
        community_id: mirror.id,
        inner_id: 42
      })
    )

    assert {:ok, :pass} = Indexer.upsert_article(:post, article.id)
    entries = entries(article)

    assert MapSet.new(Enum.map(entries, & &1.community_ref)) ==
             MapSet.new([source.slug, mirror.slug])

    for kind <- ["article.published", "article.updated"] do
      SearchPlatform.upsert(Enum.map(entries, &%{&1 | title: "stale", plain_text: "stale"}))
      event = enqueue(kind, source, article)
      assert {:ok, :pass} = deliver(event)
      assert Enum.sort_by(entries(article), & &1.ref) == Enum.sort_by(entries, & &1.ref)
      assert Repo.get!(Event, event.id).status == :done
    end
  end

  test "Search and Press expose only the selected Snapshot after a WorkingCopy edit" do
    {community, projected, _attrs, actor} = mock_article(:post)
    article = Repo.get!(Article, projected.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    original = Repo.get!(ArticlePublic, article.id)
    path = %{community: community.slug, thread: :post, inner_id: projected.inner_id}

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Unpublished replacement title"},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, :pass} = Indexer.upsert_article(:post, article.id)
    assert [indexed] = entries(projected)
    assert indexed.indexed_snapshot_id == original.snapshot_id
    assert indexed.title == original.title
    assert {:ok, press} = CMS.Press.Query.article(path)
    assert press.content_version == original.snapshot_id
    assert press.title == original.title

    assert {:ok, public_view} = CMS.FrontDesk.article(path)

    legacy_only =
      Map.merge(public_view, %{
        snapshot_id: nil,
        revision_id: Ecto.UUID.generate(),
        content_version: "legacy"
      })

    assert CMS.Press.Projection.article(community, :post, legacy_only).content_version == nil

    assert {:ok, %{public: public}} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: work.id, revision: saved.revision},
               original.snapshot_id,
               actor,
               Ecto.UUID.generate()
             )

    assert public.snapshot_id != original.snapshot_id
    assert {:ok, :pass} = Indexer.upsert_article(:post, article.id)

    assert {:ok, query} =
             Query.new(%{text: "Unpublished replacement", scope: %{article_id: article.id}}, nil)

    assert {:ok, %{entries: [%{artiment: indexed}]}} = SearchPlatform.search(query)
    assert indexed.indexed_snapshot_id == public.snapshot_id
    assert indexed.title == saved.title
    assert {:ok, press} = CMS.Press.Query.article(path)
    assert press.content_version == public.snapshot_id
    assert press.title == saved.title
  end

  test "unmirror deletes only that community entry and duplicate delivery is harmless" do
    {source, article, _attrs, _user} = mock_article(:post)
    {:ok, mirror} = db_insert(:community)

    binding =
      Repo.insert!(
        ArticleBinding.changeset(%ArticleBinding{}, %{
          article_id: article.id,
          community_id: mirror.id,
          inner_id: 42
        })
      )

    assert {:ok, :pass} = Indexer.upsert_article(:post, article.id)
    assert length(entries(article)) == 2
    # Unmirror commits deletion before its visibility child is delivered.
    Repo.delete!(binding)
    child = enqueue("article.visibility_changed", mirror, article)
    assert {:ok, :pass} = deliver(child)
    assert Enum.map(entries(article), & &1.community_ref) == [source.slug]
    assert {:ok, :pass} = deliver(child)
    assert {:ok, :pass} = Indexer.sync_binding(:post, article.id, mirror.id)
    assert Enum.map(entries(article), & &1.community_ref) == [source.slug]
    assert Repo.get!(Event, child.id).status == :done
  end

  test "a broken Snapshot projection fails indexing without deleting the last search record" do
    {community, article, _attrs, _actor} = mock_article(:post)
    assert {:ok, :pass} = Indexer.upsert_article(:post, article.id)
    assert [indexed] = entries(article)
    public = Repo.get!(ArticlePublic, article.id)
    Repo.get_by!(ArticleSnapshotPost, snapshot_id: public.snapshot_id) |> Repo.delete!()

    assert {:error, :article_snapshot_projection_missing} =
             Indexer.upsert_article(:post, article.id)

    assert {:error, :article_snapshot_projection_missing} =
             Indexer.sync_article_metrics(:post, article.id)

    event = enqueue("article.updated", community, article)
    assert {:error, :article_snapshot_projection_missing} = deliver(event)
    assert Repo.get!(Event, event.id).status == :retrying
    assert [^indexed] = entries(article)
  end

  defp enqueue(kind, community, article) do
    snapshot_id = GroupherServer.Repo.get_by!(ArticlePublic, article_id: article.id).snapshot_id

    {:ok, event} =
      enqueue_outbox(%{
        event: "article.search_sync",
        worker: GroupherServer.Jobs.CMSOutboxSearch,
        resource_type: "article",
        resource_id: article.id,
        operation_ref: Ecto.UUID.generate(),
        dedupe_key: CMS.Outbox.DedupeKey.encode([article.id, kind]),
        data: %{source_event: kind, community_id: community.id, snapshot_id: snapshot_id}
      })

    event
  end

  defp enqueue_outbox(attrs) do
    case GroupherServer.Repo.transaction(fn -> CMS.Outbox.send(attrs) end) do
      {:ok, result} -> result
      {:error, reason} -> {:error, reason}
    end
  end

  defp deliver(event) do
    GroupherServer.Jobs.CMSOutboxSearch.perform(%Oban.Job{
      args: %{"event_id" => event.id},
      attempt: 1,
      max_attempts: 8
    })
  end

  defp entries(article) do
    {:ok, query} = Query.new(%{text: article.title, scope: %{article_id: article.id}}, nil)
    {:ok, %{entries: entries}} = SearchPlatform.search(query)
    Enum.map(entries, & &1.artiment)
  end
end
