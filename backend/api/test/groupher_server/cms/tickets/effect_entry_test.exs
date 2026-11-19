defmodule GroupherServer.Test.CMS.Tickets.EffectEntryTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, PublicCache}
  alias CMS.Model.{ArticleBinding, Community, TicketState}
  alias CMS.Outbox.Event
  alias CMS.Tickets.{Cache, Effects}

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)
    on_exit(fn -> Application.put_env(:groupher_server, :env, previous) end)
    article_id = Ecto.UUID.generate()

    %{
      community: %Community{id: 7, slug: "ticket-entry"},
      state: %TicketState{article_id: article_id, article_binding_id: 3, type: :user},
      binding: %ArticleBinding{
        id: 3,
        article_id: article_id,
        community_id: 7,
        inner_id: 42,
        thread: :ticket
      },
      operation_ref: Ecto.UUID.generate()
    }
  end

  test "the external effect key API is removed from every facade" do
    for module <- [Cache, Effects.Cache] do
      Code.ensure_loaded!(module)
      refute function_exported?(module, :enqueue, 6)
      assert function_exported?(module, :projection_changed, 5)
    end

    Code.ensure_loaded!(Effects)
    refute function_exported?(Effects, :enqueue_cache, 6)
  end

  test "canonical target sets replay once and distinct operations or affected sets remain fresh",
       f do
    assert {:ok, [first]} = enqueue(f, [17, 9, 17])
    assert {:ok, [same]} = enqueue(f, [9, 17])
    assert same.id == first.id
    assert first.event == "ticket.cache_invalidation"
    assert first.worker == "GroupherServer.Jobs.CMSOutboxTicket"
    assert first.resource_type == "ticket"
    assert first.resource_id == f.state.article_id
    assert first.operation_ref == f.operation_ref
    assert first.data["cache_tags"] == expected_tags(f, [9, 17])

    assert {:ok, [changed_targets]} = enqueue(f, [9, 18])
    refute changed_targets.dedupe_key == first.dedupe_key
    assert {:ok, [new_operation]} = enqueue(%{f | operation_ref: Ecto.UUID.generate()}, [17, 9])
    refute new_operation.dedupe_key == first.dedupe_key
    assert new_operation.data == first.data

    assert Repo.aggregate(from(e in Event, where: e.resource_id == ^f.state.article_id), :count) ==
             3

    assert Repo.aggregate(
             from(j in Oban.Job,
               where: j.args["event_id"] in ^[first.id, changed_targets.id, new_operation.id]
             ),
             :count
           ) == 3
  end

  test "mismatched scopes and invalid affected Post identities write neither events nor jobs",
       f do
    before_events = Repo.all(Event)
    before_jobs = Repo.all(Oban.Job)

    for invalid <- [
          %{f | binding: %{f.binding | community_id: 8}},
          %{f | binding: %{f.binding | article_id: Ecto.UUID.generate()}},
          %{f | binding: %{f.binding | id: 4}},
          %{f | binding: %{f.binding | thread: :post}},
          %{f | state: %{f.state | type: :worker}},
          %{f | binding: %{f.binding | inner_id: nil}}
        ] do
      assert {:error, _} = enqueue(invalid, [])
    end

    for ids <- [[nil], ["17"], [-1]] do
      assert {:error, _} = enqueue(f, ids)
    end

    assert Repo.all(Event) == before_events
    assert Repo.all(Oban.Job) == before_jobs
  end

  test "batch boundaries and wakeups are stable under reordered duplicate Post targets", f do
    ids = Enum.to_list(1..(PublicCache.max_tags_per_request() + 7))
    before_jobs = Repo.aggregate(Oban.Job, :count)
    assert {:ok, first} = enqueue(f, ids)
    assert length(first) > 1
    assert {:ok, replay} = enqueue(f, Enum.reverse(ids) ++ ids)
    assert Enum.sort(Enum.map(first, & &1.id)) == Enum.sort(Enum.map(replay, & &1.id))
    assert Repo.aggregate(Oban.Job, :count) == before_jobs + length(first)
    assert Enum.sort(Enum.flat_map(first, & &1.data["cache_tags"])) == expected_tags(f, ids)

    assert Enum.all?(
             first,
             &(length(&1.data["cache_tags"]) <= PublicCache.max_tags_per_request())
           )
  end

  defp enqueue(f, ids) do
    Repo.transact_result(fn ->
      Cache.projection_changed(f.community, f.state, f.binding, ids, f.operation_ref)
    end)
  end

  defp expected_tags(f, ids) do
    ([
       PublicCache.ticket_list_tag(f.community.slug),
       PublicCache.ticket_detail_tag(f.community.slug, f.binding.inner_id)
     ] ++
       Enum.flat_map(ids, fn id ->
         [
           PublicCache.article_detail_tag(f.community.slug, :post, id),
           PublicCache.article_list_tag(f.community.slug, :post)
         ]
       end))
    |> Enum.uniq()
    |> Enum.sort()
  end
end
