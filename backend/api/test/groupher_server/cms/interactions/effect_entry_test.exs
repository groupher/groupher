defmodule GroupherServer.Test.CMS.Interactions.EffectEntryTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Interactions.Effects
  alias CMS.Model.{Article, Comment}
  alias CMS.Outbox.Event

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)
    on_exit(fn -> Application.put_env(:groupher_server, :env, previous) end)
    %{article: %Article{id: Ecto.UUID.generate()}, actor: %User{id: 7}}
  end

  test "callers cannot select an event, resource type or payload" do
    Code.ensure_loaded!(Effects)
    refute function_exported?(Effects, :enqueue_reaction_changed, 5)
    refute function_exported?(Effects, :reaction_data, 2)
  end

  test "fixed actions replay once while a new operation survives a return to the same state", f do
    first = Ecto.UUID.generate()
    second = Ecto.UUID.generate()

    for {kind, action, extra} <- [
          {"interaction.upvote_changed", &Effects.upvote_changed(f.article, f.actor, :add, &1),
           %{}},
          {"interaction.emotion_changed",
           &Effects.emotion_changed(f.article, f.actor, :add, :heart, &1),
           %{"emotion" => "heart"}},
          {"interaction.collect_changed", &Effects.collect_changed(f.article, f.actor, :add, &1),
           %{}}
        ] do
      jobs = Repo.aggregate(Oban.Job, :count)
      events = Repo.aggregate(Event, :count)
      assert {:ok, :pass} = Repo.transact_result(fn -> action.(first) end)
      event = Repo.get_by!(Event, event: kind, operation_ref: first)
      assert event.worker == "GroupherServer.Jobs.CMSOutboxInteraction"
      assert event.resource_type == "article"
      assert event.resource_id == f.article.id

      assert event.data ==
               Map.merge(%{"actor_id" => 7, "operation" => "add", "community_id" => nil}, extra)

      assert {:ok, :pass} = Repo.transact_result(fn -> action.(first) end)
      assert Repo.aggregate(Event, :count) == events + 1
      assert Repo.aggregate(Oban.Job, :count) == jobs + 1
      assert {:ok, :pass} = Repo.transact_result(fn -> action.(second) end)
      another = Repo.get_by!(Event, event: kind, operation_ref: second)
      refute another.dedupe_key == event.dedupe_key
      assert Repo.aggregate(Event, :count) == events + 2
      assert Repo.aggregate(Oban.Job, :count) == jobs + 2
    end
  end

  test "invalid targets, actors, operations and emotions produce no durable work", f do
    operation_ref = Ecto.UUID.generate()
    before_events = Repo.all(Event)
    before_jobs = Repo.all(Oban.Job)

    constructors = [
      fn -> Effects.upvote_changed(%{id: f.article.id}, f.actor, :add, operation_ref) end,
      fn -> Effects.upvote_changed(f.article, %{id: 7}, :add, operation_ref) end,
      fn -> Effects.upvote_changed(f.article, f.actor, :toggle, operation_ref) end,
      fn -> Effects.collect_changed(%Comment{id: 1}, f.actor, :add, operation_ref) end,
      fn -> Effects.emotion_changed(f.article, f.actor, :add, :unknown, operation_ref) end,
      fn -> Effects.emotion_changed(f.article, f.actor, :add, :upvote, operation_ref) end,
      fn ->
        Effects.emotion_changed(
          %Comment{id: 1, thread: :doc},
          f.actor,
          :add,
          :heart,
          operation_ref
        )
      end
    ]

    for construct <- constructors do
      assert {:error, _} = Repo.transact_result(construct)
    end

    assert Repo.all(Event) == before_events
    assert Repo.all(Oban.Job) == before_jobs
  end
end
