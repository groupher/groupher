defmodule GroupherServer.Test.CMS.Articles.FanoutRegistrationTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{CMS, Jobs}
  alias CMS.Articles.Effects
  alias CMS.Outbox
  alias Outbox.{DedupeKey, Event, Retry}

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)
    on_exit(fn -> Application.put_env(:groupher_server, :env, previous) end)
    :ok
  end

  test "done, dead and new children all count as registered without resetting a dead child" do
    parent = parent()
    press = child(parent, "press.cache_invalidation", Jobs.CMSOutboxPress, "community", 7, %{})

    search =
      child(
        parent,
        "article.search_sync",
        Jobs.CMSOutboxSearch,
        "article",
        parent.resource_id,
        Map.put(parent.data, "source_event", parent.event)
      )

    assert {:ok, :done} = Outbox.execute(press.id, fn _ -> {:ok, :done} end)

    assert {:error, %{reason: :outbox_delivery_exhausted}} =
             Outbox.execute(search.id, fn _ -> {:error, :permanent_failure} end, on_error: :fail)

    failed = Repo.get!(Event, search.id)

    assert {:ok, %{registered: registered, failed_child_ids: [failed_id]}} =
             Outbox.execute(parent.id, &Effects.dispatch/1)

    assert failed_id == failed.id
    assert registered.press == press.id
    assert registered.search == search.id
    assert Repo.get!(Event, parent.id).status == :done
    assert Repo.get!(Event, press.id).status == :done
    assert Repo.get!(Event, search.id) == failed
    assert Repo.get!(Event, registered.cdn).status == :waiting
    assert Repo.aggregate(from(row in Retry, where: row.event_id == ^search.id), :count) == 0

    assert Repo.aggregate(
             from(job in Oban.Job,
               where: job.args["event_id"] == ^registered.cdn and job.state == "available"
             ),
             :count
           ) == 1
  end

  test "a crash after child registration reuses every child and wakeup on parent retry" do
    parent = parent()

    assert {:error, %RuntimeError{}} =
             Outbox.execute(parent.id, fn event ->
               assert {:ok, %{registered: children}} = Effects.dispatch(event)
               send(self(), {:registered_children, children})
               raise "crashed before parent completion"
             end)

    assert_receive {:registered_children, original}

    assert {:ok, %{registered: repeated, failed_child_ids: []}} =
             Outbox.execute(parent.id, &Effects.dispatch/1)

    assert repeated == original
    assert Repo.get!(Event, parent.id).status == :done

    Enum.each(Map.values(original), fn id ->
      assert Repo.aggregate(from(job in Oban.Job, where: job.args["event_id"] == ^id), :count) ==
               1
    end)
  end

  test "a conflicting child rolls back new siblings and leaves the parent retryable" do
    parent = parent()

    conflicting =
      child(
        parent,
        "article.search_sync",
        Jobs.CMSOutboxSearch,
        "article",
        parent.resource_id,
        Map.put(parent.data, "source_event", "article.published")
      )

    assert {:error, {:outbox_payload_conflict, id}} =
             Outbox.execute(parent.id, &Effects.dispatch/1)

    assert id == conflicting.id
    assert Repo.get!(Event, parent.id).status == :retrying
    assert Repo.get!(Event, conflicting.id).data == conflicting.data

    refute Repo.get_by(Event,
             event: "press.cache_invalidation",
             dedupe_key: DedupeKey.encode([parent.id])
           )

    refute Repo.get_by(Event,
             event: "article.cdn_purge",
             dedupe_key: DedupeKey.encode([parent.id])
           )
  end

  test "visibility and review transitions register children without a publication snapshot" do
    for enqueue <- [&Effects.visibility_changed/3, &Effects.review_changed/3] do
      binding = %CMS.Model.ArticleBinding{
        article_id: Ecto.UUID.generate(),
        community_id: 7,
        thread: :post,
        inner_id: 1
      }

      community = %CMS.Model.Community{id: 7, slug: "fanout"}

      assert {:ok, parent} =
               Repo.transact_result(fn -> enqueue.(binding, community, Ecto.UUID.generate()) end)

      kind = parent.event

      assert {:ok, %{registered: children}} = Outbox.execute(parent.id, &Effects.dispatch/1)
      search = Repo.get!(Event, children.search)
      cdn = Repo.get!(Event, children.cdn)
      assert Map.has_key?(search.data, "snapshot_id")
      assert search.data["snapshot_id"] == nil
      assert cdn.data["snapshot_id"] == nil
      assert cdn.data["source_event"] == kind

      assert {:ok, tags} =
               GroupherServer.PublicCache.scope_tags(:article_visibility_changed, cdn.data)

      assert length(tags) == 2
      assert Repo.get!(Event, parent.id).status == :done
      assert {:ok, %{registered: repeated}} = Effects.dispatch(parent)
      assert repeated == children
    end
  end

  test "CDN duplicate comparison freezes the complete cache scope" do
    parent = parent()
    assert {:ok, %{registered: children}} = Effects.dispatch(parent)
    cdn = Repo.get!(Event, children.cdn)

    for {field, other} <- [{"community", "other"}, {"thread", "BLOG"}, {"inner_id", 2}] do
      assert {:error, {:outbox_payload_conflict, id}} =
               Repo.transact_result(fn ->
                 Outbox.send(%{
                   event: cdn.event,
                   worker: Jobs.CMSOutboxCDN,
                   resource_type: cdn.resource_type,
                   resource_id: cdn.resource_id,
                   operation_ref: Ecto.UUID.generate(),
                   dedupe_key: cdn.dedupe_key,
                   data: Map.put(cdn.data, field, other)
                 })
               end)

      assert id == cdn.id
      assert Repo.get!(Event, cdn.id) == cdn
    end
  end

  defp parent do
    article_id = Ecto.UUID.generate()

    binding = %CMS.Model.ArticleBinding{
      article_id: article_id,
      community_id: 7,
      thread: :post,
      inner_id: 1
    }

    community = %CMS.Model.Community{id: 7, slug: "fanout"}
    snapshot = %CMS.Model.ArticleSnapshot{id: Ecto.UUID.generate(), article_id: article_id}

    {:ok, parent} =
      Repo.transact_result(fn ->
        Effects.updated(binding, community, snapshot, Ecto.UUID.generate())
      end)

    parent
  end

  defp child(parent, event, worker, resource_type, resource_id, data) do
    send_event(%{
      event: event,
      worker: worker,
      resource_type: resource_type,
      resource_id: resource_id,
      operation_ref: parent.operation_ref,
      dedupe_key: DedupeKey.encode([parent.id]),
      data: data
    })
  end

  defp send_event(attrs) do
    {:ok, {:ok, event}} = Repo.transaction(fn -> Outbox.send(attrs) end)
    event
  end
end
