defmodule GroupherServer.Test.CMS.Interactions.RecoverySafetyTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Accounts, CMS, Jobs}
  alias Accounts.Model.User
  alias CMS.Interactions.Effects
  alias CMS.Model.{Article, GlobalPassport}
  alias CMS.Outbox.{Event, Retry}

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    {community, article, _, author} = mock_article(:post)
    {:ok, actor} = db_insert(:user)
    view = article
    article = Repo.get!(Article, article.id) |> Map.put(:community, community)
    {:ok, root} = db_insert(:user)
    Repo.insert!(GlobalPassport.changeset(%GlobalPassport{}, %{user_id: root.id, is_root: true}))

    %{
      community: community,
      article: article,
      view: view,
      author: author,
      actor: actor,
      root: root
    }
  end

  for action <- [:upvote, :collect, :emotion] do
    @action action
    test "#{action} recovery refuses a missing target before reset, wakeup or receipt", f do
      missing = Map.put(%Article{id: Ecto.UUID.generate()}, :community, f.community)
      event = dead_event(@action, missing, f.actor)
      assert_refused(event, f.root, :interaction_target_not_found)
    end

    test "#{action} recovery refuses a missing original actor before any successful retry", f do
      missing_id = Repo.aggregate(User, :max, :id) + 100_000
      event = dead_event(@action, f.article, %User{id: missing_id})
      assert_refused(event, f.root, :interaction_actor_not_found)
    end

    test "#{action} recovery preserves identity and the actual worker completes once", f do
      event = dead_command_event(@action, f)
      assert event.data["community_id"] == f.community.id

      with_jobs(fn ->
        assert {:ok, %{outcome: :requeued}} =
                 CMS.retry_outbox_event(event.id, 1, f.root, "dependencies verified")

        assert {:ok, %{outcome: :already_retried}} =
                 CMS.retry_outbox_event(event.id, 1, f.root, "repeat the same investigation")
      end)

      assert Repo.aggregate(Retry, :count) == 1
      assert Enum.count(Repo.all(Oban.Job), &(&1.args["event_id"] == event.id)) == 1
      job = %Oban.Job{args: %{"event_id" => event.id}, attempt: 1, max_attempts: 8}
      assert {:ok, :pass} = Jobs.CMSOutboxInteraction.perform(job)
      delivered = Repo.get!(Event, event.id)
      assert delivered.status == :done, inspect(delivered)
      assert {:ok, :pass} = Jobs.CMSOutboxInteraction.perform(job)
      current = Repo.get!(Event, event.id)
      assert current.status == :done
      assert current.operation_ref == event.operation_ref
      assert current.dedupe_key == event.dedupe_key
      assert current.data == event.data
      assert current.contract_version == event.contract_version
      assert current.failure_generation == event.failure_generation
      assert Repo.aggregate(Retry, :count) == 1
    end
  end

  for scope <- [:missing, :unbound, :unrecorded] do
    @scope scope
    test "recovery refuses #{@scope} request Community without guessing another binding", f do
      event = dead_command_event(:upvote, f)

      community_id =
        case @scope do
          :missing -> Repo.aggregate(CMS.Model.Community, :max, :id) + 100_000
          :unbound -> db_insert(:community) |> elem(1) |> Map.fetch!(:id)
          :unrecorded -> nil
        end

      event =
        Repo.update!(
          Ecto.Changeset.change(event, data: Map.put(event.data, "community_id", community_id))
        )

      assert_refused(event, f.root, :interaction_target_invalid)
    end
  end

  test "the worker rechecks a target trashed after a successful recovery", f do
    event = dead_event(:upvote, f.article, f.actor)

    with_jobs(fn ->
      assert {:ok, %{outcome: :requeued}} =
               CMS.retry_outbox_event(event.id, 1, f.root, "dependencies verified")
    end)

    assert {:ok, _} =
             CMS.Articles.trash_receipt(f.view, f.author,
               community_id: f.community.id,
               command_id: Ecto.UUID.generate()
             )

    assert {:ok, :pass} =
             Jobs.CMSOutboxInteraction.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 8,
               max_attempts: 8
             })

    current = Repo.get!(Event, event.id)
    assert current.status == :failed
    assert current.failure_generation == 2
    assert current.completed_at == nil
    assert current.last_error_code == "4914"
    assert current.data == event.data
    assert current.operation_ref == event.operation_ref
    assert current.dedupe_key == event.dedupe_key
    assert_refused(current, f.root, :interaction_target_invalid)
  end

  defp dead_event(action, article, actor) do
    operation_ref = Ecto.UUID.generate()

    assert {:ok, :pass} =
             Repo.transact_result(fn ->
               case action do
                 :upvote -> Effects.upvote_changed(article, actor, :add, operation_ref)
                 :collect -> Effects.collect_changed(article, actor, :add, operation_ref)
                 :emotion -> Effects.emotion_changed(article, actor, :add, :heart, operation_ref)
               end
             end)

    event = Repo.get_by!(Event, operation_ref: operation_ref)

    assert {:error, _} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :injected_delivery_failure} end,
               on_error: :fail
             )

    Repo.get!(Event, event.id)
  end

  defp dead_command_event(action, f) do
    command_id = Ecto.UUID.generate()

    result =
      case action do
        :upvote -> CMS.Interactions.upvote(f.view, f.actor, command_id)
        :collect -> CMS.Interactions.collect(f.view, f.actor, command_id)
        :emotion -> CMS.Interactions.emotion(f.view, :heart, f.actor, command_id)
      end

    assert {:ok, _} = result

    receipt = Repo.get_by!(CMS.Model.CommandReceipt, command_id: command_id)
    event = Repo.get_by!(Event, operation_ref: receipt.operation_ref)

    assert {:error, _} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :injected_delivery_failure} end,
               on_error: :fail
             )

    Repo.get!(Event, event.id)
  end

  defp assert_refused(event, root, reason) do
    before = facts()

    with_jobs(fn ->
      assert {:error, %{reason: ^reason}} =
               CMS.retry_outbox_event(event.id, event.failure_generation, root, "investigated")
    end)

    assert facts() == before
    assert Repo.get!(Event, event.id) == event
  end

  defp facts do
    Map.new([Event, Retry, Oban.Job], fn schema ->
      {schema, Repo.all(schema) |> Map.new(&{&1.id, &1})}
    end)
  end

  defp with_jobs(action) do
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)

    try do
      action.()
    after
      Application.put_env(:groupher_server, :env, previous)
    end
  end
end
