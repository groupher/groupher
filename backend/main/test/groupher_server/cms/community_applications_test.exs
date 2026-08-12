defmodule GroupherServer.Test.CMS.CommunityApplicationsTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias CMS.CommunityApplications.Jobs.CreateCommunity
  alias CMS.Communities.Jobs.Setup

  alias CMS.Model.{
    Community,
    CommunityApplication,
    CommunityApplicationLogoUpload,
    CommunityAsset,
    CommunitySlugClaim
  }

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, %{user: user}}
  end

  test "rejects reserved slugs before claiming them", %{user: user} do
    upload = finalized_logo(user, "reserved")

    assert {:error, :reserved_slug} =
             CMS.CommunityApplications.submit(
               application_attrs(upload, "home"),
               user,
               "idem_home"
             )
  end

  test "submits idempotently and enforces one blocking application", %{user: user} do
    upload = finalized_logo(user, "first")
    attrs = application_attrs(upload, "apply-first")

    assert {:ok, application} =
             CMS.CommunityApplications.submit(attrs, user, "idem_first_application")

    assert application.status == :submitted
    assert application.logo_asset_ref == upload.public_ref

    assert %CommunitySlugClaim{expires_at: claim_expiry} =
             Repo.one(
               from(claim in CommunitySlugClaim,
                 where: claim.application_id == ^application.id and is_nil(claim.released_at)
               )
             )

    assert claim_expiry == application.expires_at

    assert {:ok, same_application} =
             CMS.CommunityApplications.submit(attrs, user, "idem_first_application")

    assert same_application.id == application.id

    second_upload = finalized_logo(user, "second")

    assert {:error, :active_application_exists} =
             CMS.CommunityApplications.submit(
               application_attrs(second_upload, "apply-second"),
               user,
               "idem_second_application"
             )
  end

  test "concurrent submissions still create only one blocking Application", %{user: user} do
    first_upload = finalized_logo(user, "concurrent-first")
    second_upload = finalized_logo(user, "concurrent-second")

    results =
      [
        {application_attrs(first_upload, "concurrent-first"), "idem_concurrent_first"},
        {application_attrs(second_upload, "concurrent-second"), "idem_concurrent_second"}
      ]
      |> Enum.map(fn {attrs, key} ->
        Task.async(fn -> CMS.CommunityApplications.submit(attrs, user, key) end)
      end)
      |> Task.await_many(10_000)

    assert Enum.count(results, &match?({:ok, %CommunityApplication{}}, &1)) == 1
    assert Enum.count(results, &match?({:error, :active_application_exists}, &1)) == 1

    assert Repo.aggregate(
             from(a in CommunityApplication,
               where: a.user_id == ^user.id and a.status == :submitted
             ),
             :count
           ) == 1
  end

  test "cancelling releases the claim and permits another application", %{user: user} do
    upload = finalized_logo(user, "cancel")

    assert {:ok, application} =
             CMS.CommunityApplications.submit(
               application_attrs(upload, "apply-cancel"),
               user,
               "idem_cancel_application"
             )

    assert {:ok, cancelled} =
             CMS.CommunityApplications.cancel(application.public_ref, user, application.version)

    assert cancelled.status == :cancelled
    assert CMS.CommunityApplications.can_apply(user).allowed

    claim = Repo.get_by!(CommunitySlugClaim, application_id: application.id)
    assert claim.released_at
    assert is_nil(claim.expires_at)
  end

  test "starting review clears both Application and Claim expiry", %{user: user} do
    application = submit_application(user, "review-expiry")
    assert application.expires_at

    assert {:ok, reviewing} =
             CMS.CommunityApplications.start_review(
               application.public_ref,
               reviewer(user),
               application.version
             )

    assert reviewing.status == :reviewing
    assert is_nil(reviewing.expires_at)

    claim = Repo.get_by!(CommunitySlugClaim, application_id: application.id)
    assert is_nil(claim.expires_at)
  end

  test "expired submissions release their claim and unblock the applicant", %{user: user} do
    application = submit_application(user, "expire-submitted")
    now = DateTime.utc_now(:second)
    expired_at = DateTime.add(now, -60, :second)

    from(a in CommunityApplication, where: a.id == ^application.id)
    |> Repo.update_all(set: [expires_at: expired_at])

    from(claim in CommunitySlugClaim, where: claim.application_id == ^application.id)
    |> Repo.update_all(set: [expires_at: expired_at])

    assert {:ok, 1} = CMS.CommunityApplications.expire_due(now)
    assert Repo.get!(CommunityApplication, application.id).status == :expired
    assert Repo.get_by!(CommunitySlugClaim, application_id: application.id).released_at
    assert CMS.CommunityApplications.can_apply(user).allowed
  end

  test "review start and expiry race converge to one valid result", %{user: user} do
    application = submit_application(user, "review-expiry-race")
    now = DateTime.utc_now(:second)

    from(a in CommunityApplication, where: a.id == ^application.id)
    |> Repo.update_all(set: [expires_at: now])

    results =
      [
        fn ->
          CMS.CommunityApplications.start_review(
            application.public_ref,
            reviewer(user),
            application.version
          )
        end,
        fn -> CMS.CommunityApplications.expire_due(now) end
      ]
      |> Enum.map(&Task.async/1)
      |> Task.await_many(10_000)

    current = Repo.get!(CommunityApplication, application.id)
    claim = Repo.get_by!(CommunitySlugClaim, application_id: application.id)

    assert current.status in [:reviewing, :expired]
    assert is_nil(current.expires_at)
    assert is_nil(claim.expires_at)

    case current.status do
      :reviewing ->
        assert Enum.any?(results, &match?({:ok, %CommunityApplication{status: :reviewing}}, &1))
        assert is_nil(claim.released_at)

      :expired ->
        assert Enum.any?(results, &match?({:ok, 1}, &1))
        assert claim.released_at
    end
  end

  test "review operations enforce permission and optimistic version", %{user: user} do
    application = submit_application(user, "review-guard")

    assert {:error, :review_permission_denied} =
             CMS.CommunityApplications.start_review(
               application.public_ref,
               user,
               application.version
             )

    assert {:error, :application_state_conflict} =
             CMS.CommunityApplications.start_review(
               application.public_ref,
               reviewer(user),
               application.version + 1
             )
  end

  test "retry creation reports a competing slug claim", %{user: user} do
    application = submit_application(user, "retry-claimed")
    review_user = reviewer(user)

    assert {:ok, reviewing} =
             CMS.CommunityApplications.start_review(
               application.public_ref,
               review_user,
               application.version
             )

    assert {:ok, approved} =
             CMS.CommunityApplications.approve(
               reviewing.public_ref,
               review_user,
               reviewing.version,
               %{}
             )

    assert {:ok, failed} =
             CMS.CommunityApplications.mark_creation_failed(
               approved.public_ref,
               "create_failed_test",
               :forced_failure
             )

    {:ok, other_user} = db_insert(:user)
    _competing = submit_application(other_user, "retry-claimed")

    assert {:error, :slug_claimed} =
             CMS.CommunityApplications.retry_creation(
               failed.public_ref,
               review_user,
               failed.version
             )

    assert Repo.get!(CommunityApplication, failed.id).status == :creation_failed
  end

  test "approved Application stays private until Setup completes", %{user: user} do
    application = submit_application(user, "apply-happy-path")
    review_user = reviewer(user)

    assert {:ok, reviewing} =
             CMS.CommunityApplications.start_review(
               application.public_ref,
               review_user,
               application.version
             )

    assert {:ok, approved} =
             CMS.CommunityApplications.approve(
               reviewing.public_ref,
               review_user,
               reviewing.version,
               %{"note" => "approved in integration test"}
             )

    create_job = application_job(CreateCommunity, approved.public_ref)
    assert application_job_count(CreateCommunity, approved.public_ref) == 1
    assert :ok = CreateCommunity.perform(job_from(create_job))
    assert :ok = CreateCommunity.perform(job_from(create_job))

    setting_up = Repo.get!(CommunityApplication, approved.id)
    assert setting_up.status == :setting_up
    assert {:error, _} = CMS.FrontDesk.community(setting_up.slug)

    assert {:ok, %{entries: entries}} =
             CMS.Communities.paged(%{page: 1, size: 100})

    refute Enum.any?(entries, &(&1.slug == setting_up.slug))
    assert {:ok, %{entries: []}} = CMS.Search.community(setting_up.slug)
    assert {:error, {:not_exist, "Public Community"}} = CMS.Press.site_manifest(setting_up.slug)

    assert {:ok, failed} =
             CMS.Communities.mark_setup_failed(
               approved.public_ref,
               Ecto.UUID.generate(),
               :setup_error,
               1
             )

    assert failed.status == :setup_failed

    assert Repo.get_by!(CMS.Model.CommunityLifecycle, community_id: failed.community_id).state ==
             :setup_failed

    assert Repo.exists?(
             from(audit in CMS.Model.AuditLog,
               where:
                 audit.community_id == ^failed.community_id and
                   audit.action == "community.setup_failed"
             )
           )

    assert {:ok, retried} =
             CMS.Communities.retry_setup(approved.public_ref, review_user, failed.version)

    assert retried.status == :setting_up

    assert Repo.get_by!(CMS.Model.CommunityLifecycle, community_id: failed.community_id).state ==
             :setting_up

    assert Repo.exists?(
             from(audit in CMS.Model.AuditLog,
               where:
                 audit.community_id == ^failed.community_id and
                   audit.action == "community.setup_retried"
             )
           )

    setup_job = application_job(Setup, approved.public_ref)
    setup_operation_ref = setup_job.args["operation_ref"]

    assert {:ok, _uuid} = Ecto.UUID.cast(setup_operation_ref)

    assert %CMS.Model.AuditLog{operation_ref: ^setup_operation_ref} =
             Repo.get_by!(CMS.Model.AuditLog,
               community_id: failed.community_id,
               action: "community.setup_retried"
             )

    assert %CMS.Model.CommunityApplicationEvent{operation_ref: ^setup_operation_ref} =
             Repo.get_by!(CMS.Model.CommunityApplicationEvent,
               application_id: approved.id,
               to_status: :setting_up,
               operation_ref: setup_operation_ref
             )

    assert :ok = Setup.perform(job_from(setup_job))
    assert :ok = Setup.perform(job_from(setup_job))

    created = Repo.get!(CommunityApplication, approved.id)
    assert created.status == :created
    assert created.completed_at

    lifecycle = Repo.get_by!(CMS.Model.CommunityLifecycle, community_id: created.community_id)
    assert lifecycle.state == :active

    assert %CMS.Model.AuditLog{operation_ref: ^setup_operation_ref} =
             Repo.get_by!(CMS.Model.AuditLog,
               community_id: created.community_id,
               action: "community.activated"
             )

    assert {:ok, public_community} = CMS.FrontDesk.community(created.slug)
    assert public_community.id == created.community_id
    assert {:ok, %{entries: [search_result]}} = CMS.Search.community(created.slug)
    assert search_result.id == created.community_id
    assert {:ok, %{community: %{slug: slug}}} = CMS.Press.site_manifest(created.slug)
    assert slug == created.slug
    assert Repo.aggregate(from(c in Community, where: c.slug == ^created.slug), :count) == 1

    upload = Repo.get_by!(CommunityApplicationLogoUpload, application_id: created.id)
    assert upload.status == :promoted

    assert Repo.get!(CommunityAsset, upload.community_asset_id).community_id ==
             created.community_id
  end

  test "Creation failure rolls back every core Community write", %{user: user} do
    application = submit_application(user, "creation-rollback")
    review_user = reviewer(user)

    {:ok, reviewing} =
      CMS.CommunityApplications.start_review(
        application.public_ref,
        review_user,
        application.version
      )

    {:ok, approved} =
      CMS.CommunityApplications.approve(
        reviewing.public_ref,
        review_user,
        reviewing.version,
        %{}
      )

    from(upload in CommunityApplicationLogoUpload, where: upload.application_id == ^approved.id)
    |> Repo.update_all(set: [status: :expired])

    assert {:error, :asset_not_ready} =
             CMS.Communities.create_from_application(approved.public_ref, "rollback_test")

    assert Repo.get!(CommunityApplication, approved.id).status == :approved
    refute Repo.exists?(from(c in Community, where: c.slug == ^approved.slug))

    refute Repo.exists?(
             from(lifecycle in CMS.Model.CommunityLifecycle,
               where: lifecycle.application_id == ^approved.id
             )
           )
  end

  test "invalid form fields do not masquerade as an authorization failure", %{user: user} do
    upload = finalized_logo(user, "invalid-input")

    assert {:error, :invalid_application_input} =
             CMS.CommunityApplications.submit(
               application_attrs(upload, "invalid-input")
               |> Map.put(:title, String.duplicate("x", 81)),
               user,
               "idem_invalid_input"
             )
  end

  defp finalized_logo(user, suffix) do
    now = DateTime.utc_now(:second)

    %CommunityApplicationLogoUpload{}
    |> CommunityApplicationLogoUpload.changeset(%{
      public_ref: "app_logo_#{user.id}_#{suffix}_12345678",
      user_id: user.id,
      filename: "#{suffix}.png",
      mime_type: "image/png",
      size_bytes: 128,
      status: :finalized,
      storage: "r2",
      storage_key: "community-applications/#{user.id}/#{suffix}/original",
      url: "https://assets.groupher.test/a/app_logo_#{user.id}_#{suffix}_12345678/original",
      content_hash: "sha256:#{String.duplicate("a", 64)}",
      expires_at: DateTime.add(now, 3600, :second),
      finalized_at: now
    })
    |> Repo.insert!()
  end

  defp submit_application(user, slug) do
    upload = finalized_logo(user, slug)

    {:ok, application} =
      CMS.CommunityApplications.submit(
        application_attrs(upload, slug),
        user,
        "idem_#{slug}"
      )

    application
  end

  defp reviewer(user) do
    Map.put(user, :cur_passport, %{
      "global" => %{
        "community.application.review" => true,
        "community.application.approve" => true,
        "community.application.reject" => true,
        "community.application.retry_creation" => true,
        "community.application.retry_setup" => true
      }
    })
  end

  defp application_job(worker, application_ref) do
    worker_name = worker |> Atom.to_string() |> String.trim_leading("Elixir.")

    Oban.Job
    |> where([job], job.worker == ^worker_name)
    |> order_by([job], desc: job.id)
    |> Repo.all()
    |> Enum.find(&(&1.args["application_ref"] == application_ref))
    |> then(&(&1 || flunk("expected #{worker_name} job for #{application_ref}")))
  end

  defp application_job_count(worker, application_ref) do
    worker_name = worker |> Atom.to_string() |> String.trim_leading("Elixir.")

    Oban.Job
    |> where([job], job.worker == ^worker_name)
    |> Repo.all()
    |> Enum.count(&(&1.args["application_ref"] == application_ref))
  end

  defp job_from(job) do
    %Oban.Job{args: job.args, attempt: 1, max_attempts: job.max_attempts}
  end

  defp application_attrs(upload, slug) do
    %{
      title: "Test Community",
      slug: slug,
      desc: "A sufficiently descriptive community application for the V1 workflow.",
      logo_asset_ref: upload.public_ref,
      locale: "en",
      apply_category: :PRODUCT,
      apply_message: "Please review this application."
    }
  end
end
