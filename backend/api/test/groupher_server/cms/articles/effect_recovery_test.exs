defmodule GroupherServer.Test.CMS.Articles.EffectRecoveryTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    ArticleWorkingCopy,
    DocsRelease,
    DocsReleaseArticle,
    DocsReleaseTreeSnapshot
  }

  alias CMS.Outbox.{Event, Retry}

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    {community, view, _, actor} = mock_article(:post)
    %{community: community, article: Repo.get!(Article, view.id), root: actor}
  end

  test "retry and diagnostics share committed publication proof without resetting the old event",
       ctx do
    old = effect(ctx.article, "article.projections") |> fail()
    next_publish(ctx)
    replacement = effect(ctx.article, "article.projections", exclude: old.id)
    old_row = Repo.get!(Event, old.id)
    jobs = Repo.all(Oban.Job)
    retries = Repo.all(Retry)

    assert {:ok, diagnosis} = CMS.diagnose_outbox_failures(ctx.root)

    assert %{event_id: old_id, superseded_by: replacement_id, replacement_status: :waiting} =
             Enum.find(diagnosis.superseded, &(&1.event_id == old.id))

    assert old_id == old.id
    assert replacement_id == replacement.id
    refute Enum.any?(diagnosis.pending, &(&1.event_id == old.id))

    assert {:ok, %{outcome: :superseded, event_id: ^old_id, superseded_by: ^replacement_id}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(old.id, 1, ctx.root, "reviewed replacement")
             end)

    assert Repo.get!(Event, old.id) == old_row
    assert Repo.all(Oban.Job) == jobs
    assert Repo.all(Retry) == retries

    fail(replacement)
    assert {:ok, diagnosis} = CMS.diagnose_outbox_failures(ctx.root)
    assert Enum.any?(diagnosis.pending, &(&1.event_id == replacement.id))

    assert Enum.any?(
             diagnosis.superseded,
             &(&1.event_id == old.id and &1.replacement_status == :failed)
           )

    attrs =
      old
      |> Map.take([:event, :resource_type, :resource_id, :operation_ref, :dedupe_key, :data])
      |> Map.put(:worker, GroupherServer.Jobs.CMSOutboxArticle)

    assert {:error, {:outbox_effect_dead, ^old_id}} =
             Repo.transact_result(fn -> CMS.Outbox.send(attrs) end)
  end

  test "first-publication notification remains pending after a later publication", ctx do
    notification = effect(ctx.article, "article.first_published_notification") |> fail()
    next_publish(ctx)
    assert {:ok, result} = CMS.diagnose_outbox_failures(ctx.root)
    assert Enum.any?(result.pending, &(&1.event_id == notification.id))
    refute Enum.any?(result.superseded, &(&1.event_id == notification.id))

    assert {:ok, %{outcome: :requeued}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(notification.id, 1, ctx.root, "notification still owed")
             end)
  end

  test "partial targets, missing intents, changed contracts and forged publication provenance keep the failure",
       ctx do
    old = effect(ctx.article, "article.projections") |> fail()
    next_publish(ctx)
    replacement = effect(ctx.article, "article.projections", exclude: old.id)

    for changes <- [
          %{data: Map.put(replacement.data, "community_id", ctx.community.id + 1000)},
          %{data: Map.put(replacement.data, "inner_id", replacement.data["inner_id"] + 1)},
          %{data: Map.put(replacement.data, "snapshot_id", old.data["snapshot_id"])},
          %{data: Map.put(replacement.data, "release_id", 999_999)},
          %{operation_ref: Ecto.UUID.generate()},
          %{contract_version: 99},
          %{data: Map.delete(replacement.data, "published_by_id")},
          %{worker: "GroupherServer.Jobs.CMSOutboxSearch"}
        ] do
      changed = Repo.update!(Ecto.Changeset.change(replacement, changes))
      assert {:ok, %{outcome: :pending}} = CMS.Articles.Effects.recovery_status(old)

      Repo.update!(
        Ecto.Changeset.change(
          changed,
          Map.take(Map.from_struct(replacement), Map.keys(changes))
        )
      )
    end

    Repo.delete!(replacement)
    assert {:ok, %{outcome: :pending}} = CMS.Articles.Effects.recovery_status(old)

    assert {:ok, %{outcome: :requeued}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(old.id, 1, ctx.root, "replacement missing")
             end)
  end

  test "root admission precedes diagnostics and recovery, and batches remain bounded", ctx do
    old = effect(ctx.article, "article.projections") |> fail()
    next_publish(ctx)
    {:ok, stranger} = db_insert(:user)
    stranger = Map.put(stranger, :cur_passport, %{"global" => %{"god" => true}})
    assert {:error, :permission_denied} = CMS.diagnose_outbox_failures(stranger)

    assert {:error, :permission_denied} =
             CMS.retry_outbox_event(old.id, 1, stranger, "not authorized")

    assert {:ok, %{scanned: 1}} = CMS.diagnose_outbox_failures(ctx.root, 1)

    assert {:error, :invalid_outbox_diagnostics_request} =
             CMS.diagnose_outbox_failures(ctx.root, 101)

    assert Repo.get!(Event, old.id).status == :failed
    assert Repo.all(Retry) == []
  end

  test "stale generations cannot use superseded to bypass the recovery fence", ctx do
    old = effect(ctx.article, "article.projections") |> fail()
    next_publish(ctx)

    assert {:error, :outbox_recovery_stale_generation} =
             with_jobs(fn -> CMS.retry_outbox_event(old.id, 2, ctx.root, "wrong generation") end)

    assert Repo.get!(Event, old.id) == old
    assert Repo.all(Retry) == []
  end

  test "Search and CDN children require their own matching replacement intents", ctx do
    parent = effect(ctx.article, "article.published")
    assert {:ok, _} = CMS.Articles.Effects.dispatch(parent)
    old_search = effect(ctx.article, "article.search_sync") |> fail()
    old_cdn = effect(ctx.article, "article.cdn_purge") |> fail()
    next_publish(ctx)
    next_parent = effect(ctx.article, "article.updated")
    assert {:ok, _} = CMS.Articles.Effects.dispatch(next_parent)
    next_search = effect(ctx.article, "article.search_sync", exclude: old_search.id)
    next_cdn = effect(ctx.article, "article.cdn_purge", exclude: old_cdn.id)

    assert {:ok, %{outcome: :superseded, superseded_by: id}} =
             CMS.Articles.Effects.recovery_status(old_search)

    assert id == next_search.id
    assert {:ok, %{outcome: :superseded}} = CMS.Articles.Effects.recovery_status(old_cdn)
    Repo.delete!(next_cdn)
    assert {:ok, %{outcome: :pending}} = CMS.Articles.Effects.recovery_status(old_cdn)
  end

  test "Docs replacement follows sealed release ancestry, including a release with only tree changes",
       ctx do
    doc = doc_source()
    original = release(doc, nil)
    old = doc_intent(doc, original.id) |> fail()
    middle = release(doc, original.id, member: false)
    latest = release(doc, middle.id)
    replacement = doc_intent(doc, latest.id)

    assert {:ok, %{outcome: :superseded, superseded_by: id}} =
             CMS.Articles.Effects.recovery_status(old)

    assert id == replacement.id

    assert {:ok, %{outcome: :superseded}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(old.id, 1, ctx.root, "sealed descendant exists")
             end)

    assert Repo.get!(Event, old.id) == old
    assert Repo.all(Retry) == []
  end

  test "same snapshot, unrelated release, absent member and unsealed release are insufficient" do
    doc = doc_source()
    original = release(doc, nil)
    old = doc_intent(doc, original.id) |> fail()
    unrelated = release(doc, nil)
    doc_intent(doc, unrelated.id)
    assert {:ok, %{outcome: :pending}} = CMS.Articles.Effects.recovery_status(old)

    incomplete = release(doc, original.id, member: false)
    doc_intent(doc, incomplete.id)
    assert {:ok, %{outcome: :pending}} = CMS.Articles.Effects.recovery_status(old)

    unsealed = release(doc, original.id, sealed: false)
    replacement = doc_intent(doc, unsealed.id)
    assert {:ok, %{outcome: :pending}} = CMS.Articles.Effects.recovery_status(old)
    Repo.update!(Ecto.Changeset.change(unsealed, sealed: true))

    assert {:ok, %{outcome: :superseded, superseded_by: id}} =
             CMS.Articles.Effects.recovery_status(old)

    assert id == replacement.id
  end

  defp doc_source do
    {community, view, _, actor} = mock_article(:doc)
    article = Repo.get!(Article, view.id)
    public = Repo.get!(ArticlePublic, article.id)
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)

    %{
      community: community,
      article: article,
      actor: actor,
      snapshot_id: public.snapshot_id,
      inner_id: binding.inner_id
    }
  end

  defp release(doc, base, opts \\ []) do
    snapshot =
      Repo.insert!(
        DocsReleaseTreeSnapshot.changeset(%DocsReleaseTreeSnapshot{}, %{
          community_id: doc.community.id,
          tree_json: %{"version" => 1, "nodes" => []},
          created_at: DateTime.utc_now(:second)
        })
      )

    release =
      Repo.insert!(
        DocsRelease.changeset(%DocsRelease{}, %{
          community_id: doc.community.id,
          tree_snapshot_id: snapshot.id,
          queue_revision: 1,
          base_release_id: base,
          plan_format_version: 1,
          published_by_id: doc.actor.id,
          published_at: DateTime.utc_now(:second),
          sealed: false
        })
      )

    if Keyword.get(opts, :member, true) do
      Repo.insert!(
        DocsReleaseArticle.changeset(%DocsReleaseArticle{}, %{
          release_id: release.id,
          article_id: doc.article.id,
          action: :publish,
          snapshot_id: doc.snapshot_id
        })
      )
    end

    if Keyword.get(opts, :sealed, true) do
      Repo.update!(Ecto.Changeset.change(release, sealed: true))
    else
      release
    end
  end

  defp doc_intent(doc, release_id) do
    {:ok, event} =
      Repo.transact_result(fn ->
        binding =
          Repo.get_by!(CMS.Model.ArticleBinding,
            article_id: doc.article.id,
            community_id: doc.community.id
          )

        snapshot = Repo.get!(CMS.Model.ArticleSnapshot, doc.snapshot_id)
        # Negative diagnostic fixtures may refer to an unsealed stored Release.
        # The recovery owner must verify the persisted fact rather than trust this DTO.
        release = %{Repo.get!(DocsRelease, release_id) | sealed: true}

        CMS.Articles.Effects.release_updated(
          binding,
          doc.community,
          snapshot,
          release,
          Ecto.UUID.generate()
        )
      end)

    event
  end

  defp next_publish(ctx) do
    copy = Repo.get_by!(ArticleWorkingCopy, article_id: ctx.article.id, scope_type: :default)
    head = Repo.get!(ArticlePublic, ctx.article.id)

    {:ok, saved} =
      CMS.Articles.save_working_copy(
        ctx.article,
        ctx.community,
        copy.id,
        %{title: "Recovery replacement #{Ecto.UUID.generate()}"},
        copy.revision,
        ctx.root,
        Ecto.UUID.generate()
      )

    assert {:ok, _} =
             CMS.Articles.publish_article(
               ctx.article,
               ctx.community,
               %{working_copy_id: copy.id, revision: saved.revision},
               head.snapshot_id,
               ctx.root,
               Ecto.UUID.generate()
             )
  end

  defp effect(article, name, opts \\ []) do
    excluded = Keyword.get(opts, :exclude, Ecto.UUID.generate())

    Repo.one!(
      from(event in Event,
        where: event.resource_id == ^article.id and event.event == ^name,
        where: event.id != ^excluded
      )
    )
  end

  defp fail(event) do
    assert {:error, _} =
             CMS.Outbox.execute(event.id, fn _ -> {:error, :provider_unavailable} end,
               on_error: :fail
             )

    Repo.get!(Event, event.id)
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
