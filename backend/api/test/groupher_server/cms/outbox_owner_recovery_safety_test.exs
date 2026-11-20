defmodule GroupherServer.Test.CMS.OutboxOwnerRecoverySafetyTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Jobs}
  alias Accounts.Model.User
  alias CMS.Model.{Article, ArticlePublic, ArticleWorkingCopy, Comment, Community, GlobalPassport}
  alias CMS.Outbox.{Event, Retry}

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    {community, view, _, actor} = mock_article(:post)
    Repo.insert!(GlobalPassport.changeset(%GlobalPassport{}, %{user_id: actor.id, is_root: true}))
    %{community: community, article: Repo.get!(Article, view.id), actor: actor}
  end

  test "a missing Public prevents projection reset without changing event, job or retry facts",
       f do
    event = projection(f) |> fail()
    Repo.delete!(Repo.get!(ArticlePublic, f.article.id))
    assert_refused(event, f.actor, :projection_not_found)
  end

  test "a projection rejects a different Binding scope before recovery", f do
    event = projection(f) |> fail()

    event =
      Repo.update!(
        Ecto.Changeset.change(event, data: Map.update!(event.data, "inner_id", &(&1 + 1)))
      )

    assert_refused(event, f.actor, :projection_not_found)
  end

  test "a proven successor remains superseded even when the current Public has gone", f do
    event = projection(f) |> fail()
    work = Repo.get_by!(ArticleWorkingCopy, article_id: f.article.id, scope_type: :default)
    public = Repo.get!(ArticlePublic, f.article.id)

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               f.article,
               f.community,
               work.id,
               %{title: "Successor"},
               work.revision,
               f.actor,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Articles.publish_article(
               f.article,
               f.community,
               %{working_copy_id: work.id, revision: saved.revision},
               public.snapshot_id,
               f.actor,
               Ecto.UUID.generate()
             )

    Repo.delete!(Repo.get!(ArticlePublic, f.article.id))
    before = facts()

    assert {:ok, %{outcome: :superseded, event_id: id}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(
                 event.id,
                 event.failure_generation,
                 f.actor,
                 "successor verified"
               )
             end)

    assert id == event.id
    assert facts() == before
  end

  test "a recovered projection rechecks a Public removed before actual worker delivery", f do
    event = projection(f) |> fail()
    assert_requeued(event, f.actor)
    Repo.delete!(Repo.get!(ArticlePublic, f.article.id))
    assert {:ok, :pass} = Jobs.CMSOutboxArticle.perform(job(event))
    current = Repo.get!(Event, event.id)
    assert current.status == :failed
    assert current.failure_generation == 2
    assert current.completed_at == nil
    assert current.data == event.data
    assert current.operation_ref == event.operation_ref
    complete_wakeup(current)
    assert_refused(current, f.actor, :projection_not_found)
  end

  test "enabled Search rejects a missing root while disabled Search retains its legal acknowledgement",
       f do
    event = search_event(f) |> fail()
    assert_refused(event, f.actor, :projection_not_found)
    previous = Application.fetch_env!(:groupher_server, :search_artiments)

    Application.put_env(
      :groupher_server,
      :search_artiments,
      Keyword.put(previous, :platform, CMS.SearchArtiments.Disabled)
    )

    try do
      assert_requeued(event, f.actor)
      assert {:ok, :pass} = Jobs.CMSOutboxSearch.perform(job(event))
      assert Repo.get!(Event, event.id).status == :done
    after
      Application.put_env(:groupher_server, :search_artiments, previous)
    end
  end

  test "visibility Search needs its Community but permits the removed Binding cleanup", f do
    missing = visibility_search(f) |> fail()

    missing =
      Repo.update!(
        Ecto.Changeset.change(missing,
          data: Map.update!(missing.data, "community_id", &(&1 + 100_000))
        )
      )

    assert_refused(missing, f.actor, :projection_not_found)

    event = visibility_search(f) |> fail()
    assert_requeued(event, f.actor)
    assert {:ok, :pass} = Jobs.CMSOutboxSearch.perform(job(event))
    assert Repo.get!(Event, event.id).status == :done
  end

  test "a removed Mention source is a legal stale acknowledgement, not a blanket recovery refusal",
       f do
    ref = Ecto.UUID.generate()

    assert {:ok, event} =
             Repo.transact_result(fn ->
               CMS.ArtimentMentions.Effects.enqueue_notifications(
                 ref,
                 "revision:gone",
                 Ecto.UUID.generate(),
                 f.community.id,
                 [f.actor.id]
               )
             end)

    event = fail(event)
    before_mentions = Repo.all(GroupherServer.Messaging.Model.Mention)
    assert_requeued(event, f.actor)
    assert {:ok, :pass} = Jobs.CMSMentionNotifier.perform(job(event))
    assert Repo.get!(Event, event.id).status == :done
    assert Repo.get!(Event, event.id).data == event.data
    assert Repo.all(GroupherServer.Messaging.Model.Mention) == before_mentions
  end

  test "Comment creation rejects a missing Comment or actor without a reset", f do
    missing = %Comment{id: 999_999_991, article_id: f.article.id}

    assert {:ok, event} =
             Repo.transact_result(fn ->
               CMS.Comments.Effects.created(missing, f.actor, f.community, Ecto.UUID.generate())
             end)

    assert_refused(fail(event), f.actor, :effect_target_not_found)

    comment = actual_comment(f)

    event =
      Repo.get_by!(Event,
        resource_type: "comment",
        resource_id: to_string(comment.id),
        event: "comment.created"
      )
      |> fail()

    missing_id = Repo.aggregate(User, :max, :id) + 100_000

    event =
      Repo.update!(
        Ecto.Changeset.change(event, data: Map.put(event.data, "actor_id", missing_id))
      )

    assert_refused(event, f.actor, :effect_target_not_found)
  end

  test "Comment deletion requires its parent Article but does not require the deleted Comment",
       f do
    article = %Article{id: Ecto.UUID.generate()}
    comment = %Comment{id: 999_999_992, article_id: article.id}

    assert {:ok, event} =
             Repo.transact_result(fn ->
               CMS.Comments.Effects.deleted(comment, article, Ecto.UUID.generate())
             end)

    assert_refused(fail(event), f.actor, :not_exist)

    assert {:ok, valid} =
             Repo.transact_result(fn ->
               CMS.Comments.Effects.deleted(
                 %Comment{id: 999_999_993, article_id: f.article.id},
                 f.article,
                 Ecto.UUID.generate()
               )
             end)

    event = fail(valid)
    assert_requeued(event, f.actor)
    assert {:ok, :pass} = Jobs.CMSOutboxComment.perform(job(event))
    assert Repo.get!(Event, event.id).status == :done
  end

  test "a destroyed Community remains readable to operations but cannot provision analytics", f do
    {:ok, community} = db_insert(:community)

    assert {:ok, event} =
             Repo.transact_result(fn ->
               CMS.Communities.Effects.enqueue_analysis_provision(community, Ecto.UUID.generate())
             end)

    event = fail(event)
    assert_requeued(event, f.actor)
    destroy(community)
    assert {:ok, _retained} = CMS.FrontDesk.community(community.id, mode: :internal)
    assert {:ok, :pass} = Jobs.CMSOutboxCommunity.perform(job(event))
    current = Repo.get!(Event, event.id)
    assert current.status == :failed
    assert current.failure_generation == 2
    assert current.completed_at == nil
    complete_wakeup(current)
    assert_refused(current, f.actor, :invalid_outbox_resource)
  end

  test "a valid analytics target retains the configured deferred provision behavior", f do
    assert {:ok, event} =
             Repo.transact_result(fn ->
               CMS.Communities.Effects.enqueue_analysis_provision(
                 f.community,
                 Ecto.UUID.generate()
               )
             end)

    event = fail(event)
    assert_requeued(event, f.actor)
    assert {:ok, :pass} = Jobs.CMSOutboxCommunity.perform(job(event))
    assert Repo.get!(Event, event.id).status == :done
  end

  test "analytics payload cannot point to a Community different from its persisted resource", f do
    assert {:ok, event} =
             Repo.transact_result(fn ->
               CMS.Communities.Effects.enqueue_analysis_provision(
                 f.community,
                 Ecto.UUID.generate()
               )
             end)

    event = fail(event)

    event =
      Repo.update!(
        Ecto.Changeset.change(event,
          data: %{event.data | "community_id" => f.community.id + 100_000}
        )
      )

    assert_refused(event, f.actor, :invalid_outbox_resource)
  end

  defp projection(f) do
    Repo.get_by!(Event, resource_id: f.article.id, event: "article.projections")
  end

  defp search_event(f) do
    article_id = Ecto.UUID.generate()

    binding = %CMS.Model.ArticleBinding{
      article_id: article_id,
      community_id: f.community.id,
      inner_id: 777,
      thread: :post
    }

    snapshot = %CMS.Model.ArticleSnapshot{id: Ecto.UUID.generate(), article_id: article_id}

    assert {:ok, parent} =
             Repo.transact_result(fn ->
               CMS.Articles.Effects.updated(binding, f.community, snapshot, Ecto.UUID.generate())
             end)

    assert {:ok, %{registered: %{search: id}}} = CMS.Articles.Effects.dispatch(parent)
    Repo.get!(Event, id)
  end

  defp visibility_search(f) do
    {:ok, community} = db_insert(:community)

    binding = %CMS.Model.ArticleBinding{
      article_id: f.article.id,
      community_id: community.id,
      inner_id: 777,
      thread: :post
    }

    assert {:ok, parent} =
             Repo.transact_result(fn ->
               CMS.Articles.Effects.visibility_changed(binding, community, Ecto.UUID.generate())
             end)

    assert {:ok, %{registered: %{search: id}}} = CMS.Articles.Effects.dispatch(parent)
    Repo.get!(Event, id)
  end

  defp actual_comment(f) do
    assert {:ok, comment} =
             CMS.Comments.create_comment(
               f.community,
               :post,
               article_inner_id(f.article, f.community),
               mock_comment(),
               f.actor,
               Ecto.UUID.generate()
             )

    Repo.get!(Comment, comment.id)
  end

  defp destroy(community) do
    assert {:ok, _} =
             CMS.Communities.Lifecycle.request_destroy(community.id,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.schedule_destroy(community.id,
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.destroy(community.id, operation_ref: Ecto.UUID.generate())
  end

  defp fail(event) do
    assert {:error, _} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :injected_delivery_failure} end,
               on_error: :fail
             )

    Repo.get!(Event, event.id)
  end

  defp job(event), do: %Oban.Job{args: %{"event_id" => event.id}, attempt: 8, max_attempts: 8}

  defp assert_requeued(event, actor) do
    assert {:ok, %{outcome: :requeued}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(
                 event.id,
                 event.failure_generation,
                 actor,
                 "dependencies verified"
               )
             end)

    assert Repo.get!(Event, event.id).operation_ref == event.operation_ref
  end

  defp assert_refused(event, actor, reason) do
    before = facts()

    assert {:error, %{reason: ^reason}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(event.id, event.failure_generation, actor, "investigated")
             end)

    assert facts() == before
  end

  defp complete_wakeup(event) do
    Repo.update_all(from(job in Oban.Job, where: job.args["event_id"] == ^event.id),
      set: [state: "completed"]
    )
  end

  defp facts do
    Map.new([Event, Retry, Oban.Job], fn schema ->
      {schema, Repo.all(schema) |> Map.new(&{&1.id, &1})}
    end)
  end

  defp with_jobs(fun) do
    old = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)

    try do
      fun.()
    after
      Application.put_env(:groupher_server, :env, old)
    end
  end
end
