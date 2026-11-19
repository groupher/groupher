defmodule GroupherServer.Test.CMS.Articles.EffectEntryTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Articles.Effects
  alias CMS.Model.{ArticleBinding, ArticlePublic, ArticleSnapshot, Community, DocsRelease}
  alias CMS.Outbox.Event

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)
    on_exit(fn -> Application.put_env(:groupher_server, :env, previous) end)
    id = Ecto.UUID.generate()
    community = %Community{id: 7, slug: "entry"}

    binding = %ArticleBinding{
      article_id: id,
      community_id: community.id,
      thread: :post,
      inner_id: 1
    }

    snapshot = %ArticleSnapshot{article_id: id, id: Ecto.UUID.generate()}
    public = %ArticlePublic{article_id: id, snapshot_id: snapshot.id, published_by_id: 9}
    release = %DocsRelease{id: 42, community_id: community.id, sealed: true}

    %{
      binding: binding,
      community: community,
      snapshot: snapshot,
      public: public,
      release: release,
      operation_ref: Ecto.UUID.generate()
    }
  end

  test "the generic event and resource chooser is not exported" do
    for module <- [Effects, Effects.Outbox] do
      Code.ensure_loaded!(module)
      refute function_exported?(module, :enqueue, 5)
      refute function_exported?(module, :send_article, 5)
    end
  end

  test "named entries fix event, resource, worker, projection and replay identity", f do
    constructors = [
      {"article.published",
       fn -> Effects.published(f.binding, f.community, f.snapshot, f.operation_ref) end},
      {"article.updated",
       fn -> Effects.updated(f.binding, f.community, f.snapshot, f.operation_ref) end},
      {"article.published",
       fn ->
         Effects.release_published(f.binding, f.community, f.snapshot, f.release, f.operation_ref)
       end},
      {"article.updated",
       fn ->
         Effects.release_updated(f.binding, f.community, f.snapshot, f.release, f.operation_ref)
       end},
      {"article.projections",
       fn -> Effects.projections_selected(f.binding, f.public, true, f.operation_ref) end},
      {"article.visibility_changed",
       fn -> Effects.visibility_changed(f.binding, f.community, f.operation_ref) end},
      {"article.review_changed",
       fn -> Effects.review_changed(f.binding, f.community, f.operation_ref) end},
      {"article.visibility_changed",
       fn -> Effects.release_removed(f.binding, f.community, f.release, f.operation_ref) end}
    ]

    before_events = Repo.all(Event)
    before_jobs = Repo.aggregate(Oban.Job, :count)

    inserted =
      for {kind, enqueue} <- constructors do
        assert {:ok, first} = Repo.transact_result(enqueue)
        assert first.event == kind
        assert first.worker == "GroupherServer.Jobs.CMSOutboxArticle"
        assert first.resource_type == "article"
        assert first.resource_id == f.binding.article_id
        assert first.operation_ref == f.operation_ref
        assert first.contract_version == 1
        assert first.data["community_id"] == f.community.id
        assert first.data["inner_id"] == f.binding.inner_id
        assert {:ok, repeated} = Repo.transact_result(enqueue)
        assert repeated == first

        assert Repo.aggregate(
                 from(job in Oban.Job, where: job.args["event_id"] == ^first.id),
                 :count
               ) == 1

        first
      end

    assert Enum.sort(Repo.all(Event)) == Enum.sort(before_events ++ inserted)
    assert Repo.aggregate(Oban.Job, :count) == before_jobs + length(constructors)
  end

  test "snapshot, Binding, Public and sealed Release scope mismatches write nothing", f do
    before_events = Repo.all(Event) |> Enum.sort()
    before_jobs = Repo.all(Oban.Job) |> Enum.sort()
    other_community = %{f.community | id: 8}
    other_snapshot = %{f.snapshot | article_id: Ecto.UUID.generate()}
    other_public = %{f.public | article_id: Ecto.UUID.generate()}

    invalid = [
      fn -> Effects.updated(f.binding, other_community, f.snapshot, f.operation_ref) end,
      fn -> Effects.published(f.binding, f.community, other_snapshot, f.operation_ref) end,
      fn -> Effects.projections_selected(f.binding, other_public, true, f.operation_ref) end,
      fn -> Effects.visibility_changed(f.binding, other_community, f.operation_ref) end,
      fn -> Effects.review_changed(f.binding, other_community, f.operation_ref) end
    ]

    for release <- [
          %{f.release | sealed: false},
          %{f.release | id: nil},
          %{f.release | community_id: 8}
        ] do
      for enqueue <- [
            fn ->
              Effects.release_published(
                f.binding,
                f.community,
                f.snapshot,
                release,
                f.operation_ref
              )
            end,
            fn ->
              Effects.release_updated(
                f.binding,
                f.community,
                f.snapshot,
                release,
                f.operation_ref
              )
            end,
            fn -> Effects.release_removed(f.binding, f.community, release, f.operation_ref) end
          ] do
        assert {:error, :invalid_article_effect_arguments} = Repo.transact_result(enqueue)
      end
    end

    for enqueue <- invalid do
      assert {:error, :invalid_article_effect_arguments} = Repo.transact_result(enqueue)
    end

    assert Enum.sort(Repo.all(Event)) == before_events
    assert Enum.sort(Repo.all(Oban.Job)) == before_jobs
  end

  test "one review operation keeps each Community Binding effect separate", f do
    before_events = Repo.all(Event)
    other_community = %{f.community | id: 8, slug: "other"}
    other_binding = %{f.binding | community_id: other_community.id, inner_id: 2}

    assert {:ok, first} =
             Repo.transact_result(fn ->
               Effects.review_changed(f.binding, f.community, f.operation_ref)
             end)

    assert {:ok, second} =
             Repo.transact_result(fn ->
               Effects.review_changed(other_binding, other_community, f.operation_ref)
             end)

    refute first.id == second.id
    refute first.dedupe_key == second.dedupe_key
    assert Enum.sort(Repo.all(Event)) == Enum.sort(before_events ++ [first, second])
  end

  test "a sealed Release is immutable business data during duplicate comparison", f do
    assert {:ok, event} =
             Repo.transact_result(fn ->
               Effects.release_updated(
                 f.binding,
                 f.community,
                 f.snapshot,
                 f.release,
                 f.operation_ref
               )
             end)

    assert {:error, {:outbox_payload_conflict, id}} =
             Repo.transact_result(fn ->
               CMS.Outbox.send(%{
                 event: event.event,
                 worker: GroupherServer.Jobs.CMSOutboxArticle,
                 resource_type: event.resource_type,
                 resource_id: event.resource_id,
                 operation_ref: Ecto.UUID.generate(),
                 dedupe_key: event.dedupe_key,
                 data: Map.put(event.data, "release_id", f.release.id + 1)
               })
             end)

    assert id == event.id
    assert Repo.get!(Event, event.id) == event

    assert Repo.aggregate(from(job in Oban.Job, where: job.args["event_id"] == ^event.id), :count) ==
             1
  end
end
