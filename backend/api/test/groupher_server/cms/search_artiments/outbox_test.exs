defmodule GroupherServer.Test.CMS.SearchArtiments.OutboxTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false
  alias GroupherServer.CMS
  alias CMS.Model.ArticleBinding
  alias CMS.Outbox.Event
  alias CMS.SearchArtiments.{Indexer, Query}
  alias Helper.TestFakes.SearchArtiments, as: SearchPlatform

  setup do
    SearchPlatform.reset()
    :ok
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

  defp enqueue(kind, community, article) do
    {:ok, event} =
      CMS.Outbox.send(%{
        event: "article.search_sync",
        worker: GroupherServer.Jobs.CMSOutboxSearch,
        resource_type: "article",
        resource_id: article.id,
        identity: {:workflow, Ecto.UUID.generate()},
        data: %{source_event: kind, community_id: community.id}
      })

    event
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
