defmodule GroupherServer.PublicCacheTest do
  use GroupherServer.DataCase, async: true

  import Ecto.Query

  alias GroupherServer.{PublicCache, Repo}
  alias PublicCache.{Model.Invalidation, Policy, PurgeWorker, Tags}

  @tag_fixture_path Path.expand(
                      "../../../../packages/contracts/fixtures/public-cache-tags-v1.json",
                      __DIR__
                    )

  test "matches the shared cross-language tag vectors" do
    %{"vectors" => vectors} = @tag_fixture_path |> File.read!() |> Jason.decode!()

    Enum.each(vectors, fn %{"kind" => kind, "input" => input, "expected" => expected} ->
      actual =
        case kind do
          "community" ->
            Tags.community(input["community"])

          "articleList" ->
            Tags.article_list(input["community"], input["thread"])

          "articleDetail" ->
            Tags.article_detail(input["community"], input["thread"], input["innerId"])

          "comments" ->
            Tags.comments(input["community"], input["thread"], input["innerId"])

          "tags" ->
            Tags.tags(input["community"], input["thread"])

          "docTree" ->
            Tags.doc_tree(input["community"])
        end

      assert actual == expected
    end)
  end

  test "generates canonical tags for each public scope" do
    assert Tags.community("home") == "community[home]"
    assert Tags.article_list("home", :post) == "community[home]-thread[POST]-articles"

    assert Tags.article_detail("home", :post, 42) ==
             "community[home]-thread[POST]-article[42]"

    assert Tags.comments("home", :post, 42) ==
             "community[home]-thread[POST]-article[42]-comments"

    assert Tags.tags("home", :post) == "community[home]-thread[POST]-tags"
    assert Tags.doc_tree("home") == "community[home]-doc-tree"
  end

  test "maps an article publication to detail and list invalidation" do
    assert {:ok, tags} =
             Tags.for_invalidation(:article_published, %{
               community: "home",
               thread: :post,
               inner_id: 42
             })

    assert tags == [
             "community[home]-thread[POST]-article[42]",
             "community[home]-thread[POST]-articles"
           ]
  end

  test "keeps community-only invalidations independent from article locators" do
    assert {:ok, ["community[home]"]} =
             Tags.for_invalidation(:community_presentation_changed, %{community: "home"})

    assert {:ok, ["community[home]-doc-tree", "community[home]-thread[DOC]-articles"]} =
             Tags.for_invalidation(:doc_tree_changed, %{community: "home"})
  end

  test "persists one typed invalidation without calling an external service" do
    assert {:ok, invalidation} =
             PublicCache.invalidate_now(
               :article_published,
               %{
                 community: "home",
                 thread: :post,
                 inner_id: 42,
                 id: 100
               },
               causation_id: "11111111-1111-4111-8111-111111111111"
             )

    assert %Invalidation{
             type: :article_published,
             status: :pending,
             contract_version: 1,
             payload: %{
               "community" => "home",
               "thread" => "post",
               "inner_id" => 42,
               "article_id" => 100,
               "community_id" => nil
             }
           } = Repo.get!(Invalidation, invalidation.id)
  end

  test "does not let a second worker claim an in-flight invalidation" do
    assert {:ok, invalidation} =
             PublicCache.invalidate_now(
               :community_presentation_changed,
               %{community: "home"},
               causation_id: "22222222-2222-4222-8222-222222222222"
             )

    assert {:ok, %Invalidation{status: :delivering, locked_by: first_lock}} =
             PublicCache.claim(invalidation.id, "first-worker")

    assert {:busy, retry_after_seconds} =
             PublicCache.claim(invalidation.id, "second-worker")

    assert retry_after_seconds in 1..Policy.delivery_lease_seconds()

    Repo.update_all(from(row in Invalidation, where: row.id == ^invalidation.id),
      set: [locked_at: DateTime.add(DateTime.utc_now(:second), -300, :second)]
    )

    assert {:ok, %Invalidation{status: :delivering, locked_by: second_lock, attempts: 2}} =
             PublicCache.claim(invalidation.id, "second-worker")

    assert {:error, :stale_lock} =
             PublicCache.mark_failed(
               invalidation.id,
               first_lock,
               invalidation.type,
               :cloudflare_timeout,
               true
             )

    assert :ok =
             PublicCache.mark_failed(
               invalidation.id,
               second_lock,
               invalidation.type,
               :cloudflare_timeout,
               true
             )

    assert :dead = PublicCache.claim(invalidation.id, "second-worker")
  end

  test "snoozes an in-flight delivery and reclaims it after the lease expires" do
    assert {:ok, invalidation} =
             PublicCache.invalidate_now(
               :article_published,
               %{community: "home"},
               causation_id: "66666666-6666-4666-8666-666666666666"
             )

    assert {:ok, %Invalidation{attempts: 1}} =
             PublicCache.claim(invalidation.id, "crashed-worker")

    job = %Oban.Job{
      id: 3,
      args: %{"invalidation_id" => invalidation.id},
      attempt: 1,
      max_attempts: Policy.max_attempts()
    }

    assert {:snooze, retry_after_seconds} = PurgeWorker.perform(job)
    assert retry_after_seconds in 1..Policy.delivery_lease_seconds()

    assert %Invalidation{status: :delivering, attempts: 1, locked_by: "crashed-worker"} =
             Repo.get!(Invalidation, invalidation.id)

    Repo.update_all(from(row in Invalidation, where: row.id == ^invalidation.id),
      set: [locked_at: DateTime.add(DateTime.utc_now(:second), -300, :second)]
    )

    assert :ok = PurgeWorker.perform(%{job | attempt: 2})

    assert %Invalidation{status: :dead, attempts: 2, locked_at: nil, locked_by: nil} =
             Repo.get!(Invalidation, invalidation.id)
  end

  test "uses second-based bounded retry backoff" do
    assert PurgeWorker.backoff(%Oban.Job{attempt: 1}) ==
             Policy.retry_base_delay_seconds()

    assert PurgeWorker.backoff(%Oban.Job{attempt: 20}) ==
             Policy.max_retry_delay_seconds()
  end

  test "keeps only incomplete delivery jobs unique and configures orphan rescue" do
    unique =
      %{invalidation_id: Ecto.UUID.generate()}
      |> PurgeWorker.new()
      |> Ecto.Changeset.fetch_change!(:unique)

    assert :completed not in unique.states
    assert :executing in unique.states

    oban_config = Application.fetch_env!(:groupher_server, Oban)
    plugins = Keyword.fetch!(oban_config, :plugins)

    assert {Oban.Plugins.Lifeline, lifeline_opts} =
             List.keyfind(plugins, Oban.Plugins.Lifeline, 0)

    assert Keyword.fetch!(lifeline_opts, :rescue_after) >
             :timer.seconds(Policy.delivery_lease_seconds())
  end

  test "reports durable purge backlog health" do
    assert {:ok, invalidation} =
             PublicCache.invalidate_now(
               :community_presentation_changed,
               %{community: "health"},
               causation_id: "33333333-3333-4333-8333-333333333333"
             )

    health = PublicCache.health()
    assert health.status == :ok
    assert health.pending >= 1
    assert health.oldest_pending_age_seconds >= 0
    assert health.oldest_delivering_age_seconds == nil
    assert health.delivering_without_lease == 0

    assert {:ok, _} = PublicCache.claim(invalidation.id, "health-worker")

    assert :ok =
             PublicCache.mark_failed(
               invalidation.id,
               "health-worker",
               invalidation.type,
               :cloudflare_timeout,
               true
             )

    assert PublicCache.health().status == :degraded
  end

  test "dead-letters deterministic payload and contract errors without retrying" do
    assert {:ok, invalid_payload} =
             PublicCache.invalidate_now(
               :article_published,
               %{community: "home"},
               causation_id: "44444444-4444-4444-8444-444444444444"
             )

    assert :ok =
             PurgeWorker.perform(%Oban.Job{
               id: 1,
               args: %{"invalidation_id" => invalid_payload.id},
               attempt: 1,
               max_attempts: 8
             })

    assert Repo.get!(Invalidation, invalid_payload.id).status == :dead

    assert {:ok, invalid_version} =
             PublicCache.invalidate_now(
               :community_presentation_changed,
               %{community: "home"},
               causation_id: "55555555-5555-4555-8555-555555555555"
             )

    Repo.update_all(
      from(row in Invalidation, where: row.id == ^invalid_version.id),
      set: [contract_version: 2]
    )

    assert :ok =
             PurgeWorker.perform(%Oban.Job{
               id: 2,
               args: %{"invalidation_id" => invalid_version.id},
               attempt: 1,
               max_attempts: 8
             })

    assert Repo.get!(Invalidation, invalid_version.id).status == :dead
  end
end
