defmodule GroupherServer.CMS.ProductionSeed.AcceptanceTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.CMS.ProductionSeed
  alias GroupherServer.{Repo, CMS}
  alias ProductionSeed.{Run, LoginGrant, Logins}
  alias GroupherServer.Accounts.Model.{User, OauthProvider, BrowserSession}

  setup do
    previous = System.get_env("PRODUCTION_SEED_ENABLED")
    System.put_env("PRODUCTION_SEED_ENABLED", "true")

    on_exit(fn ->
      if previous do
        System.put_env("PRODUCTION_SEED_ENABLED", previous)
      else
        System.delete_env("PRODUCTION_SEED_ENABLED")
      end
    end)

    %{database: Repo.config()[:database]}
  end

  test "requires explicit opt-in and actual database identity", %{database: db} do
    assert {:error, :seed_wrong_database} = ProductionSeed.bootstrap("first", "wrong-db")
    System.delete_env("PRODUCTION_SEED_ENABLED")
    assert {:error, :seed_disabled} = ProductionSeed.bootstrap("first", db)
    refute Repo.exists?(Run)
  end

  test "bootstrap is idempotent and isolates community/platform roles", %{database: db} do
    assert {:ok, manifest} = ProductionSeed.bootstrap("first", db)
    assert {:ok, ^manifest} = ProductionSeed.bootstrap("first", db)
    assert length(Map.values(manifest["users"])) == 8
    refute Repo.exists?(OauthProvider)
    assert get_in(manifest, ["passports", "platform", "global", "review.platform.decide"]) == true
    refute get_in(manifest, ["passports", "platform", "global", "god"])
    refute get_in(manifest, ["passports", "adminDev", "global", "review.platform.decide"])
    refute get_in(manifest, ["passports", "adminMock", "global", "review.platform.decide"])
    assert get_in(manifest, ["passports", "adminDev", "dev", "root"]) == true
    refute get_in(manifest, ["passports", "adminMock", "dev", "root"])
    assert {:error, :seed_other_run_active} = ProductionSeed.bootstrap("second", db)

    for slug <- ~w(dev mock tmp) do
      assert {:error, _} = CMS.Communities.NameRules.format_check(slug)
    end
  end

  test "unknown fixed user collision rolls back the whole run", %{database: db} do
    Repo.insert!(
      User.changeset(%User{}, %{login: "ps-author", avatar: "https://example.com/a.png"})
    )

    assert {:error, {:seed_user_collision, "author"}} = ProductionSeed.bootstrap("first", db)
    refute Repo.exists?(Run)
  end

  test "credentials are hashed, single-use, bounded, refreshable and revoked on close", %{
    database: db
  } do
    {:ok, _} = ProductionSeed.bootstrap("first", db)
    {:ok, grant} = Logins.issue("first", "author", db)
    refute Repo.one!(LoginGrant).digest == grant.credential
    assert {:ok, result} = Logins.redeem(grant.credential)
    session = Repo.get_by!(BrowserSession, ref: result.browser_session_ref)
    assert DateTime.compare(session.absolute_expires_at, Repo.one!(Run).expires_at) == :eq
    assert {:error, :seed_invalid_credential} = Logins.redeem(grant.credential)
    assert {:ok, _} = GroupherServer.Accounts.Profiles.BrowserSessions.refresh(session.ref)
    assert {:ok, _} = Logins.close("first", db)
    assert {:error, _} = GroupherServer.Accounts.Profiles.BrowserSessions.refresh(session.ref)
    assert {:ok, _} = Logins.close("first", db)
  end

  test "expiry and unknown aliases cannot create sessions", %{database: db} do
    {:ok, _} = ProductionSeed.bootstrap("first", db)
    assert {:error, :seed_unknown_alias} = Logins.issue("first", "random", db)
    {:ok, grant} = Logins.issue("first", "author", db)

    Repo.one!(LoginGrant)
    |> Ecto.Changeset.change(expires_at: ~U[2000-01-01 00:00:00Z])
    |> Repo.update!()

    assert {:error, :seed_invalid_credential} = Logins.redeem(grant.credential)
    refute Repo.exists?(BrowserSession)
  end

  test "Node artifact seeds six node types and retries without duplicates", %{database: db} do
    {:ok, _} = ProductionSeed.bootstrap("content", db)
    path = seed_artifact("content")
    assert {:ok, manifest} = ProductionSeed.Content.apply("content", db, path)
    assert Map.has_key?(manifest["resources"], "CM")
    assert Map.has_key?(manifest["resources"], "TX")
    assert {:ok, ^manifest} = ProductionSeed.Content.apply("content", db, path)
    manifest_file = Path.join(System.tmp_dir!(), "seed-manifest-#{Ecto.UUID.generate()}.json")
    reference_file = manifest_file <> ".references.json"

    on_exit(fn ->
      File.rm(manifest_file)
      File.rm(reference_file)
    end)

    File.write!(manifest_file, Jason.encode!(manifest))

    {output, code} =
      System.cmd(
        "pnpm",
        [
          "--filter",
          "@groupher/backend-auth",
          "exec",
          "tsx",
          "../../scripts/production-seed-links.mts",
          manifest_file,
          reference_file
        ],
        cd: Path.expand("../../../../..", __DIR__),
        stderr_to_stdout: true
      )

    assert code == 0, output
    assert {:ok, linked} = ProductionSeed.References.apply("content", db, reference_file)
    assert length(linked["expectedEdges"]) == 27
    assert {:ok, ^linked} = ProductionSeed.References.apply("content", db, reference_file)

    for name <- ~w(PX BX CX DX TX CM self) do
      resource = linked["resources"][name]

      locator =
        cond do
          resource["commentId"] ->
            %{type: :comment, comment_id: resource["commentId"]}

          resource["thread"] == "doc" ->
            %{type: :doc, article_id: resource["articleId"], branch_id: resource["branchId"]}

          true ->
            %{
              type: String.to_existing_atom(resource["thread"]),
              article_id: resource["articleId"]
            }
        end

      assert {:ok, _} = CMS.ArtimentMentions.sync_current(locator)
    end

    for [source, target] <- linked["expectedEdges"] do
      a = linked["resources"][source]
      b = linked["resources"][target]
      query = from(m in CMS.Model.ArtimentMention)

      query =
        if a["commentId"] do
          from(m in query, where: m.mentioner_comment_id == ^a["commentId"])
        else
          from(m in query, where: m.mentioner_article_id == ^a["articleId"])
        end

      query =
        if b["commentId"] do
          from(m in query, where: m.mentioned_comment_id == ^b["commentId"])
        else
          from(m in query, where: m.mentioned_article_id == ^b["articleId"])
        end

      assert Repo.exists?(query), "missing real projection edge #{source} -> #{target}"
    end

    for name <- ~w(PX self) do
      id = linked["resources"][name]["articleId"]

      refute Repo.exists?(
               from(m in CMS.Model.ArtimentMention,
                 where: m.mentioner_article_id == ^id and m.mentioned_article_id == ^id
               )
             )
    end

    zero = linked["resources"]["zero"]["articleId"]

    refute Repo.exists?(
             from(m in CMS.Model.ArtimentMention, where: m.mentioner_article_id == ^zero)
           )

    old_tmp = linked["communities"]["tmp"]
    assert {:ok, _} = ProductionSeed.Cleanup.delete_tmp("content", db)
    refute Repo.get(CMS.Model.Community, old_tmp)
    assert Repo.get(CMS.Model.Comment, linked["resources"]["deleteProbeComment"]["commentId"])
    {:ok, after_delete} = ProductionSeed.report("content", db)
    assert String.starts_with?(after_delete["resources"]["deleteProbe"]["url"], "/mock/")
    {:ok, rebuilt} = ProductionSeed.bootstrap("content", db)
    assert rebuilt["communities"]["tmp"] != old_tmp
    assert {:ok, _} = ProductionSeed.Content.apply("content", db, path)
  end

  test "Map failure rolls back the malformed body and survives for an ordinary retry", %{
    database: db
  } do
    previous = System.get_env("MENTION_REBUILD_FAILURE_MANIFEST")
    manifest_path = Path.join(System.tmp_dir!(), "seed-map-failure-#{Ecto.UUID.generate()}.json")
    System.put_env("MENTION_REBUILD_FAILURE_MANIFEST", manifest_path)

    on_exit(fn ->
      File.rm(manifest_path)

      if previous do
        System.put_env("MENTION_REBUILD_FAILURE_MANIFEST", previous)
      else
        System.delete_env("MENTION_REBUILD_FAILURE_MANIFEST")
      end
    end)

    {:ok, _} = ProductionSeed.bootstrap("map-failure", db)

    {:ok, manifest} =
      ProductionSeed.Content.apply("map-failure", db, seed_artifact("map-failure"))

    alias CMS.ArtimentMentions.Rebuild
    assert Rebuild.apply_all().failures == []
    id = manifest["resources"]["CM"]["commentId"]
    before = Repo.get_by!(CMS.Model.CommentBody, comment_id: id)

    assert {:ok, %{failures: [_], processed: processed}} =
             ProductionSeed.MapFailure.inject("map-failure", db)

    assert processed == 1
    assert Repo.get_by!(CMS.Model.CommentBody, comment_id: id) == before
    assert [%{"source_key" => key}] = Jason.decode!(File.read!(manifest_path))
    assert key == Rebuild.key(%{type: :comment, comment_id: id})
    assert Enum.any?(Rebuild.report_all().issues, &(&1.category == :failed_manifest))
    assert %{processed: 1, failures: []} = Rebuild.retry_failed(manifest_path)
    assert Rebuild.report_all().issues == []

    assert {:error, :seed_wrong_database} =
             ProductionSeed.MapFailure.inject("map-failure", "wrong")
  end

  test "tmp is physically deleted and remains reserved across controlled recreation", %{
    database: db
  } do
    {:ok, manifest} = ProductionSeed.bootstrap("tmp-probe", db)
    assert {:ok, _} = ProductionSeed.Cleanup.delete_tmp("tmp-probe", db)
    refute Repo.get(CMS.Model.Community, manifest["communities"]["tmp"])
    assert {:error, _} = CMS.Communities.NameRules.format_check("tmp")
    assert {:ok, rebuilt} = ProductionSeed.bootstrap("tmp-probe", db)
    assert rebuilt["communities"]["tmp"] != manifest["communities"]["tmp"]
  end

  test "cleanup requires a current report and cannot revoke a different active run", %{
    database: db
  } do
    {:ok, manifest} = ProductionSeed.bootstrap("first", db)
    {:ok, plan} = ProductionSeed.Cleanup.report("first", db, "retain")

    assert {:error, :seed_stale_cleanup_report} =
             ProductionSeed.Cleanup.apply("first", db, "retain", "wrong")

    assert {:ok, _} = ProductionSeed.Cleanup.apply("first", db, "retain", plan.report_digest)
    assert {:ok, _} = ProductionSeed.Cleanup.verify("first", db, "retain")
    {:ok, next} = ProductionSeed.bootstrap("second", db)
    assert next["users"] == manifest["users"]

    assert {:error, :seed_other_run_active} =
             ProductionSeed.Cleanup.apply("first", db, "retain", plan.report_digest)
  end

  test "purge goes through domain deletion and keeps pending effects visible", %{database: db} do
    {:ok, _} = ProductionSeed.bootstrap("purge", db)
    path = seed_artifact("purge")
    {:ok, manifest} = ProductionSeed.Content.apply("purge", db, path)
    {:ok, plan} = ProductionSeed.Cleanup.report("purge", db, "purge")
    assert plan.blockers == []
    assert {:ok, _} = ProductionSeed.Cleanup.apply("purge", db, "purge", plan.report_digest)
    {:ok, again} = ProductionSeed.Cleanup.report("purge", db, "purge")
    assert {:ok, _} = ProductionSeed.Cleanup.apply("purge", db, "purge", again.report_digest)

    for resource <- Map.values(manifest["resources"]) do
      if resource["thread"] == "ticket" do
        assert Repo.get(CMS.Model.Article, resource["articleId"])

        assert Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: resource["articleId"]).state ==
                 :draft
      else
        refute Repo.get(CMS.Model.Article, resource["articleId"])
      end
    end

    assert {:error, %{reason: :seed_cleanup_incomplete}} =
             ProductionSeed.Cleanup.verify("purge", db, "purge")
  end

  test "public GraphQL callers cannot redeem an issued credential", %{database: db} do
    {:ok, _} = ProductionSeed.bootstrap("first", db)
    {:ok, grant} = Logins.issue("first", "author", db)

    query =
      "mutation($credential: String!) { redeemProductionSeedLogin(credential: $credential) { accessToken } }"

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: %{"credential" => grant.credential}
             )

    refute Repo.exists?(BrowserSession)
  end

  test "unexpected passport grants are reported and never erased", %{database: db} do
    {:ok, manifest} = ProductionSeed.bootstrap("roles", db)
    user = Repo.get!(User, manifest["users"]["author"])
    {:ok, _} = CMS.Passport.stamp_passport(%{"global" => %{"community.create" => true}}, user)
    {:ok, report} = ProductionSeed.Cleanup.report("roles", db, "retain")
    assert :seed_permissions_changed in report.blockers

    assert {:error, {:seed_cleanup_blocked, _}} =
             ProductionSeed.Cleanup.apply("roles", db, "retain", report.report_digest)

    assert {:error, :seed_unexpected_permissions} = ProductionSeed.bootstrap("roles", db)
    assert Repo.get_by(CMS.Model.Passport, user_id: user.id)
  end

  test "public create and both rename paths reject protected slugs", %{database: db} do
    {:ok, actor} = db_insert(:user)
    actor = %{actor | cur_passport: %{"global" => %{"god" => true}}}

    for slug <- ~w(dev mock tmp) do
      assert {:error, %{reason: :reserved_slug}} =
               CMS.Communities.create(
                 %{
                   slug: slug,
                   title: "Reserved",
                   desc: "Rejected",
                   logo: "https://example.com/logo.png"
                 },
                 actor,
                 Ecto.UUID.generate()
               )
    end

    {:ok, ordinary} = mock_community(actor)

    for slug <- ~w(dev mock tmp) do
      assert {:error, %{reason: :reserved_slug}} =
               CMS.Communities.update(ordinary, %{slug: slug}, actor, Ecto.UUID.generate())

      assert {:error, %{reason: :reserved_slug}} =
               CMS.Dashboard.update(
                 ordinary,
                 :base_info,
                 %{slug: slug},
                 actor,
                 Ecto.UUID.generate()
               )
    end

    {:ok, manifest} = ProductionSeed.bootstrap("reserved", db)
    dev = Repo.get!(CMS.Model.Community, manifest["communities"]["dev"])

    assert {:error, %{reason: :reserved_slug}} =
             CMS.Communities.update(dev, %{slug: "renamed-seed"}, actor, Ecto.UUID.generate())

    assert {:ok, _} =
             CMS.Communities.update(
               dev,
               %{slug: "dev", desc: "Updated without rename"},
               actor,
               Ecto.UUID.generate()
             )
  end

  defp seed_artifact(run_id) do
    file = Path.join(System.tmp_dir!(), "production-seed-bodies-#{Ecto.UUID.generate()}.json")
    on_exit(fn -> File.rm(file) end)

    {output, code} =
      System.cmd(
        "pnpm",
        [
          "--filter",
          "@groupher/backend-auth",
          "exec",
          "tsx",
          "../../scripts/production-seed-bodybags.mts",
          run_id,
          file
        ],
        cd: Path.expand("../../../../..", __DIR__),
        stderr_to_stdout: true
      )

    assert code == 0, output
    file
  end
end
