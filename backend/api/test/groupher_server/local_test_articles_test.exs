for file <- [
      "seed/run.ex",
      "seed/target.ex",
      "local_test_actors/communities.ex",
      "local_test_actors/grants.ex",
      "seed/cleanup/run.ex",
      "seed/article/create.ex",
      "local_test_actors.ex"
    ] do
  Code.require_file("../../dev/" <> file, __DIR__)
end

defmodule GroupherServer.LocalTestArticlesTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{Accounts, CMS, Repo, Seed}
  alias Accounts.Model.OauthProvider
  alias CMS.Model.{ArticlePublic, ArticleWorkingCopy, CommandReceipt}
  alias Seed.Article.Create, as: Articles

  test "preparation persists one retry identity and refuses different content under the same key" do
    {community, _, _, owner} = mock_article(:post)
    register(owner)

    input = %{
      "alias" => "owner",
      "community" => community.slug,
      "thread" => "post",
      "key" => "primary"
    }

    assert {:error, :local_test_article_client_outdated} =
             Repo.transact_result(fn ->
               Articles.prepare_client("article-fixture-test", input)
             end)

    assert {:ok, first} =
             Repo.transact_result(fn ->
               Articles.prepare_client("article-fixture-test", Map.put(input, "protocol", 2))
             end)

    assert first.ownerLogin == owner.login
    assert first.command.action == "article.create"

    assert {:ok, again} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert first.command.commandId == again.command.commandId

    assert {:error, :local_test_article_recovery_required} =
             Repo.transact_result(fn ->
               Articles.begin_dispatch(
                 "article-fixture-test",
                 input
                 |> Map.put("commandId", Ecto.UUID.generate())
                 |> Map.put("attemptId", Ecto.UUID.generate())
               )
             end)

    begin_input =
      input
      |> Map.put("commandId", first.command.commandId)
      |> Map.put("attemptId", Ecto.UUID.generate())

    assert {:ok, %{status: "dispatched"}} =
             Repo.transact_result(fn ->
               Articles.begin_dispatch("article-fixture-test", begin_input)
             end)

    assert {:ok, %{status: "dispatched"}} =
             Repo.transact_result(fn ->
               Articles.begin_dispatch("article-fixture-test", begin_input)
             end)

    assert {:error, :local_test_article_recovery_required} =
             Repo.transact_result(fn ->
               Articles.begin_dispatch(
                 "article-fixture-test",
                 Map.put(begin_input, "attemptId", Ecto.UUID.generate())
               )
             end)

    assert {:error, :local_test_article_recovery_required} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert {:error, :local_test_article_fixture_conflict} =
             Repo.transact_result(fn ->
               Articles.prepare("article-fixture-test", Map.put(input, "title", "Changed"))
             end)

    assert {:ok, second} =
             Repo.transact_result(fn ->
               Articles.prepare("article-fixture-test", %{input | "key" => "second"})
             end)

    refute first.command.commandId == second.command.commandId
    assert {:ok, report} = GroupherServer.Seed.Cleanup.Run.report("article-fixture-test")
    assert length(report.article_fixtures_retained) == 2
    assert Enum.all?(report.article_fixtures_retained, &(&1["status"] == "pending"))

    assert MapSet.new(Enum.map(report.article_fixtures_retained, & &1["operationRef"])) ==
             MapSet.new([first.command.commandId, second.command.commandId])

    assert "article_fixture_pending" in report.blockers

    assert {:error, :local_test_article_pending} =
             Repo.transact_result(fn ->
               GroupherServer.LocalTestActors.close_run("article-fixture-test")
             end)

    assert {:ok, _, _} = GroupherServer.Seed.Run.actor("article-fixture-test", "owner")

    assert {:error, :local_test_terminal_evidence_unavailable} =
             GroupherServer.Seed.Cleanup.Run.retain_unconfirmed(
               "article-fixture-test",
               first.command.commandId,
               "downstream status unavailable"
             )

    assert {:error, :invalid_local_test_unconfirmed_operation} =
             GroupherServer.Seed.Cleanup.Run.retain_unconfirmed(
               "article-fixture-test",
               Ecto.UUID.generate(),
               "not owned by this run"
             )

    assert {:ok, %{status: "blocked", blockers: blockers}} =
             GroupherServer.Seed.Cleanup.Run.apply("article-fixture-test")

    assert "article_fixture_pending" in blockers
    assert {:ok, _, _} = GroupherServer.Seed.Run.actor("article-fixture-test", "owner")
  end

  test "a fixture cannot adopt an existing Article from a different creation command" do
    {community, public, _, owner} = mock_article(:post)
    register(owner)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: public.id, scope_type: :default)
    input = %{"alias" => "owner", "community" => community.slug, "thread" => "post"}

    assert {:ok, _} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert {:error, :local_test_article_provenance_mismatch} =
             Repo.transact_result(fn ->
               Articles.record(
                 "article-fixture-test",
                 Map.merge(input, %{"articleId" => public.id, "workingCopyId" => work.id})
               )
             end)

    assert Repo.get!(ArticleWorkingCopy, work.id).article_id == public.id
  end

  test "unconfirmed pending intents never automatically resend regardless of age" do
    {community, _, _, owner} = mock_article(:post)
    register(owner)
    input = %{"alias" => "owner", "community" => community.slug, "thread" => "post"}

    assert {:ok, first} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    for timestamp <- [
          nil,
          "invalid",
          DateTime.utc_now(:second) |> DateTime.to_iso8601(),
          DateTime.utc_now(:second) |> DateTime.add(-24 * 60 * 60) |> DateTime.to_iso8601(),
          DateTime.utc_now(:second) |> DateTime.add(60) |> DateTime.to_iso8601()
        ] do
      binding = Repo.get_by!(OauthProvider, provider_id: "article-fixture-test/owner")
      [{key, entry}] = Map.to_list(binding.raw["articles"])
      assert entry["commandId"] == first.command.commandId

      entry =
        if timestamp,
          do: entry |> Map.put("preparedAt", timestamp) |> Map.put("dispatchState", "dispatched"),
          else: entry |> Map.delete("preparedAt") |> Map.put("dispatchState", "dispatched")

      binding
      |> Ecto.Changeset.change(raw: put_in(binding.raw, ["articles", key], entry))
      |> Repo.update!()

      assert {:error, :local_test_article_recovery_required} =
               Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

      assert {:ok, %{status: "blocked"}} =
               GroupherServer.Seed.Cleanup.Run.apply("article-fixture-test")

      assert {:ok, _, _} = GroupherServer.Seed.Run.actor("article-fixture-test", "owner")
    end

    binding = Repo.get_by!(OauthProvider, provider_id: "article-fixture-test/owner")
    [{key, entry}] = Map.to_list(binding.raw["articles"])

    binding
    |> Ecto.Changeset.change(
      raw: put_in(binding.raw, ["articles", key], Map.delete(entry, "dispatchState"))
    )
    |> Repo.update!()

    assert {:error, :local_test_article_recovery_required} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)
  end

  test "a committed article is recovered from its command provenance without resending" do
    {community, _, attrs, owner} = mock_article(:post)
    register(owner)
    input = %{"alias" => "owner", "community" => community.slug, "thread" => "post"}

    assert {:ok, prepared} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    begin_article(input, prepared)

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.create_article(community, :post, attrs, owner,
               command_id: prepared.command.commandId
             )

    {:ok, other_user} = db_insert(:user)

    provenance = %{
      article_id: article.id,
      working_copy_id: work.id,
      community_id: community.id,
      command_id: prepared.command.commandId,
      snapshot_id: nil,
      publish: false
    }

    assert {:ok, %{article_id: article_id}} = CMS.verify_post_creation(provenance, owner)
    assert article_id == article.id

    assert {:error, :article_history_unavailable} =
             CMS.verify_post_creation(provenance, other_user)

    assert {:error, :article_history_unavailable} =
             CMS.verify_post_creation(%{provenance | command_id: Ecto.UUID.generate()}, owner)

    assert {:ok, nil} =
             CMS.find_article_creation_by_command(
               prepared.command.commandId,
               community.id,
               other_user
             )

    assert {:ok, nil} =
             CMS.find_article_creation_by_command(prepared.command.commandId, -1, owner)

    receipt = Repo.get_by!(CommandReceipt, command_id: prepared.command.commandId)

    receipt
    |> Ecto.Changeset.change(
      confirmation: nil,
      expires_at: DateTime.utc_now(:second) |> DateTime.add(-1)
    )
    |> Repo.update!()

    binding = Repo.get_by!(OauthProvider, provider_id: "article-fixture-test/owner")
    [{key, entry}] = Map.to_list(binding.raw["articles"])
    old = DateTime.utc_now(:second) |> DateTime.add(-48 * 60 * 60) |> DateTime.to_iso8601()

    binding
    |> Ecto.Changeset.change(raw: put_in(binding.raw, ["articles", key, "preparedAt"], old))
    |> Repo.update!()

    assert {:ok, %{existing: recovered}} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert recovered.articleId == article.id
    assert recovered.workingCopyId == work.id
    assert {:ok, _, binding} = GroupherServer.Seed.Run.actor("article-fixture-test", "owner")
    assert binding.raw["articles"][key]["status"] == "confirmed"
    assert binding.raw["articles"][key]["commandId"] == entry["commandId"]

    assert {:ok, %{existing: again}} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert again.articleId == article.id
    assert {:ok, report} = GroupherServer.Seed.Cleanup.Run.report("article-fixture-test")
    refute "article_fixture_pending" in report.blockers
  end

  test "a published article is recovered only while its public snapshot proves the command" do
    {community, _, attrs, owner} = mock_article(:post)
    register(owner)

    input = %{
      "alias" => "owner",
      "community" => community.slug,
      "thread" => "post",
      "publish" => true
    }

    assert {:ok, prepared} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    begin_article(input, prepared)

    assert {:ok, published} =
             GroupherServer.Support.Factory.create_published_article(
               community,
               :post,
               attrs,
               owner,
               command_id: prepared.command.commandId,
               check_publish_admission?: false
             )

    public = Repo.get!(ArticlePublic, published.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: published.id, scope_type: :default)

    assert {:ok, %{existing: recovered}} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert recovered.articleId == published.id
    assert recovered.workingCopyId == work.id
    assert recovered.snapshotId == public.snapshot_id
  end

  test "a pending article with a pruned receipt is not resent or silently adopted" do
    {community, _, attrs, owner} = mock_article(:post)
    register(owner)
    input = %{"alias" => "owner", "community" => community.slug, "thread" => "post"}

    assert {:ok, prepared} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    begin_article(input, prepared)

    assert {:ok, %{article: article}} =
             CMS.create_article(community, :post, attrs, owner,
               command_id: prepared.command.commandId
             )

    Repo.get_by!(CommandReceipt, command_id: prepared.command.commandId) |> Repo.delete!()

    assert {:ok, nil} =
             CMS.find_article_creation_by_command(
               prepared.command.commandId,
               community.id,
               owner
             )

    for age <- [0, -31 * 24 * 60 * 60] do
      binding = Repo.get_by!(OauthProvider, provider_id: "article-fixture-test/owner")
      [{key, _}] = Map.to_list(binding.raw["articles"])
      timestamp = DateTime.utc_now(:second) |> DateTime.add(age) |> DateTime.to_iso8601()

      binding
      |> Ecto.Changeset.change(
        raw:
          binding.raw
          |> put_in(["articles", key, "preparedAt"], timestamp)
          |> put_in(["articles", key, "dispatchState"], "dispatched")
      )
      |> Repo.update!()

      assert {:error, :local_test_article_recovery_required} =
               Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)
    end

    assert Repo.get!(CMS.Model.Article, article.id).id == article.id

    assert {:ok, %{status: "blocked", blockers: blockers}} =
             GroupherServer.Seed.Cleanup.Run.apply("article-fixture-test")

    assert "article_fixture_pending" in blockers
  end

  test "a published article without its public projection stays pending" do
    {community, _, attrs, owner} = mock_article(:post)
    register(owner)

    input = %{
      "alias" => "owner",
      "community" => community.slug,
      "thread" => "post",
      "publish" => true
    }

    assert {:ok, prepared} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    begin_article(input, prepared)

    assert {:ok, published} =
             GroupherServer.Support.Factory.create_published_article(
               community,
               :post,
               attrs,
               owner,
               command_id: prepared.command.commandId,
               check_publish_admission?: false
             )

    published.id |> then(&Repo.get!(ArticlePublic, &1)) |> Repo.delete!()

    assert {:error, :local_test_article_provenance_mismatch} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert {:ok, %{status: "blocked", blockers: blockers}} =
             GroupherServer.Seed.Cleanup.Run.apply("article-fixture-test")

    assert "article_fixture_pending" in blockers
  end

  test "unsupported threads and identities are rejected without allocating an intent" do
    assert {:error, :local_test_article_requires_post_and_community} =
             Articles.prepare("article-fixture-test", %{
               "alias" => "owner",
               "community" => "home",
               "thread" => "doc"
             })

    assert {:error, :local_test_actor_unavailable} =
             Articles.prepare("article-fixture-test", %{
               "alias" => "unknown",
               "community" => "home",
               "thread" => "post"
             })

    assert GroupherServer.Seed.Run.bindings("article-fixture-test") == []
  end

  defp begin_article(input, prepared) do
    assert {:ok, %{status: "dispatched"}} =
             Repo.transact_result(fn ->
               Articles.begin_dispatch(
                 "article-fixture-test",
                 input
                 |> Map.put("commandId", prepared.command.commandId)
                 |> Map.put("attemptId", Ecto.UUID.generate())
               )
             end)
  end

  defp register(user) do
    Repo.insert!(%OauthProvider{
      provider: "local-test-actor-v1",
      provider_id: "article-fixture-test/owner",
      user_id: user.id,
      public_ref: "oauth_" <> Ecto.UUID.generate(),
      raw: %{
        "tool" => "local-test-actor-v1",
        "run" => "article-fixture-test",
        "alias" => "owner",
        "status" => "active",
        "communities" => []
      }
    })
  end
end
