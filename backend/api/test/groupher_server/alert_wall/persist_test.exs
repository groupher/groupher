defmodule GroupherServer.Test.AlertWall.PersistTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{AlertWall, CMS, Repo}
  alias CMS.Model.ArtimentReview
  alias AlertWall.Model.{Item, UserReport}

  test "add is idempotent and a fresh AI source replaces the opinion as one unit" do
    first_ref = Ecto.UUID.generate()
    second_ref = Ecto.UUID.generate()
    first_source = Ecto.UUID.generate()
    second_source = Ecto.UUID.generate()

    first_attrs =
      item_attrs(
        first_source,
        [%{"type" => "spam", "evidence" => "link", "explanation" => "promotion"}],
        "suspect"
      )

    assert {:ok, {:ok, first}} =
             Repo.transaction(fn -> AlertWall.add_in_transaction(first_attrs, first_ref) end)

    assert {:ok, {:ok, replay}} =
             Repo.transaction(fn -> AlertWall.add_in_transaction(first_attrs, first_ref) end)

    assert replay.id == first.id

    second_attrs = item_attrs(second_source, [], "clear")

    assert {:ok, {:ok, current}} =
             Repo.transaction(fn -> AlertWall.add_in_transaction(second_attrs, second_ref) end)

    assert current.id == first.id
    assert current.ai_source_ref == second_source
    assert current.sus_notes == []
    assert current.summary == "clear"
  end

  test "replaying an add with different intent is rejected" do
    operation_ref = Ecto.UUID.generate()
    attrs = item_attrs(nil, [], "report-only")

    assert {:ok, {:ok, _item}} =
             Repo.transaction(fn -> AlertWall.add_in_transaction(attrs, operation_ref) end)

    assert {:ok, {:error, %{reason: :operation_conflict}}} =
             Repo.transaction(fn ->
               AlertWall.add_in_transaction(%{attrs | summary: "different"}, operation_ref)
             end)
  end

  test "report creation is idempotent and withdrawal updates every linked item projection" do
    {:ok, reporter} = db_insert(:user)
    operation_ref = Ecto.UUID.generate()
    attrs = report_attrs(reporter.id)

    assert {:ok, {:ok, report}} =
             Repo.transaction(fn ->
               AlertWall.submit_report_in_transaction(attrs, operation_ref)
             end)

    assert {:ok, {:ok, replay}} =
             Repo.transaction(fn ->
               AlertWall.submit_report_in_transaction(attrs, operation_ref)
             end)

    assert replay.id == report.id
    assert AlertWall.active_report_count(report.item_id) == 1

    assert {:ok, {:ok, %{report: withdrawn, item_ids: [item_id]}}} =
             Repo.transaction(fn ->
               AlertWall.withdraw_report_in_transaction(report.id, reporter.id)
             end)

    assert withdrawn.withdrawn_at
    assert item_id == report.item_id
    assert AlertWall.active_report_count(item_id) == 0
  end

  test "report CommandPipeline accepts the canonical AlertWall target and stores its Receipt" do
    {:ok, reporter} = db_insert(:user)
    command_id = Ecto.UUID.generate()

    assert {:ok, report} =
             AlertWall.submit_report(
               %{
                 owner: :cms,
                 target_type: :article,
                 target_id: "report-command-target",
                 community_id: nil,
                 subject_ref: "published-subject"
               },
               :spam,
               "Please review",
               reporter,
               command_id
             )

    assert report.reporter_id == reporter.id
    assert report.target_id == "report-command-target"

    assert {:ok, account_report} =
             AlertWall.submit_report(
               %{
                 owner: :accounts,
                 target_type: :user,
                 target_id: "108965",
                 community_id: nil,
                 subject_ref: "user:108965:profile-version-1"
               },
               :impersonation,
               "This account is impersonating another person",
               reporter,
               Ecto.UUID.generate()
             )

    assert account_report.owner == :accounts
    assert account_report.target_type == :user
  end

  test "resolve CommandPipeline returns GraphQL fields and rejects a stale item version" do
    {:ok, reviewer} = db_insert(:user)
    reviewer = %{reviewer | cur_passport: %{"global" => %{"review.platform.decide" => true}}}
    command_id = Ecto.UUID.generate()

    assert {:ok, {:ok, item}} =
             Repo.transaction(fn ->
               AlertWall.add_in_transaction(
                 item_attrs(nil, [], "needs review"),
                 Ecto.UUID.generate()
               )
             end)

    assert {:ok, %{item_id: item_id, resolution: "reviewed"}} =
             AlertWall.resolve_item(item.id, "reviewed", item.version, reviewer, command_id)

    assert item_id == item.id

    assert {:error, _reason} =
             AlertWall.resolve_item(
               item.id,
               "reviewed again",
               item.version,
               reviewer,
               Ecto.UUID.generate()
             )
  end

  test "old reports become outdated while reports on current content can be resolved" do
    {:ok, reporter} = db_insert(:user)
    first_attrs = Map.put(report_attrs(reporter.id), :subject_ref, "published-content-1")
    first_operation = Ecto.UUID.generate()

    assert {:ok, {:ok, old_report}} =
             Repo.transaction(fn ->
               AlertWall.submit_report_in_transaction(first_attrs, first_operation)
             end)

    assert {:ok, {:ok, _item}} =
             Repo.transaction(fn ->
               AlertWall.supersede_in_transaction(
                 old_report.item_id,
                 Ecto.UUID.generate(),
                 :cms
               )
             end)

    outdated = Repo.get!(UserReport, old_report.id)
    assert outdated.outdated_at
    assert is_nil(outdated.resolved_at)
    assert AlertWall.active_report_count(old_report.item_id) == 0

    current_attrs = Map.put(report_attrs(reporter.id), :subject_ref, "published-content-2")

    assert {:ok, {:ok, current_report}} =
             Repo.transaction(fn ->
               AlertWall.submit_report_in_transaction(current_attrs, Ecto.UUID.generate())
             end)

    assert {:ok, {:ok, _item}} =
             Repo.transaction(fn ->
               AlertWall.resolve_in_transaction(
                 current_report.item_id,
                 "reviewed",
                 Ecto.UUID.generate(),
                 nil
               )
             end)

    resolved = Repo.get!(UserReport, current_report.id)
    assert resolved.resolved_at
    assert resolved.resolution == "reviewed"
    assert is_nil(resolved.outdated_at)
  end

  test "AI Wall transitions stay inside the review request community scope" do
    {community_a, article, _attrs, _author} = mock_article(:post)
    {:ok, community_b} = db_insert(:community)

    current_requests =
      Repo.all(
        from(request in ArtimentReview,
          where: request.article_id == ^article.id and is_nil(request.outdated_at)
        )
      )

    system_request = Enum.find(current_requests, &is_nil(&1.community_id))
    community_a_request = Enum.find(current_requests, &(&1.community_id == community_a.id))
    assert %ArtimentReview{} = system_request
    assert %ArtimentReview{} = community_a_request
    subject_ref = system_request.subject_ref
    community_b_request = review_request(article.id, community_b.id, subject_ref)

    system_item = review_item(article.id, nil, subject_ref, system_request.id)

    community_a_item =
      review_item(article.id, community_a.id, subject_ref, community_a_request.id)

    community_b_item =
      review_item(article.id, community_b.id, subject_ref, community_b_request.id)

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               AlertWall.supersede_ai_source_in_transaction(
                 system_request.id,
                 Ecto.UUID.generate()
               )
             end)

    assert Repo.get!(Item, system_item.id).status == :superseded
    assert Repo.get!(Item, community_a_item.id).status == :open
    assert Repo.get!(Item, community_b_item.id).status == :open

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               AlertWall.resolve_ai_source_in_transaction(
                 community_a_request.id,
                 "human_cleared",
                 Ecto.UUID.generate()
               )
             end)

    assert Repo.get!(Item, community_a_item.id).status == :resolved
    assert Repo.get!(Item, community_b_item.id).status == :open
  end

  defp item_attrs(ai_source_ref, sus_notes, summary) do
    %{
      owner: :cms,
      target_type: :article,
      target_id: "stable-article",
      community_id: nil,
      subject_ref: "published-subject",
      ai_source_ref: ai_source_ref,
      sus_notes: sus_notes,
      summary: summary
    }
  end

  defp report_attrs(reporter_id) do
    %{
      reporter_id: reporter_id,
      owner: :cms,
      target_type: :article,
      target_id: "report-target",
      community_id: nil,
      subject_ref: "published-subject",
      report_type: "SPAM",
      details: "Please review"
    }
  end

  defp review_request(article_id, community_id, subject_ref) do
    now = DateTime.utc_now(:second)

    {:ok, request} =
      %ArtimentReview{}
      |> ArtimentReview.changeset(%{
        target_type: :article,
        article_id: article_id,
        community_id: community_id,
        subject_ref: subject_ref,
        policy_snapshot: %{"scope" => if(community_id, do: "community", else: "system")},
        payload: %{"text" => %{"title" => "example", "body" => "example"}},
        state: :completed,
        payload_expires_at: DateTime.add(now, 3_600, :second),
        applied_at: now
      })
      |> Repo.insert()

    request
  end

  defp review_item(article_id, community_id, subject_ref, request_id) do
    attrs = %{
      owner: :cms,
      target_type: :article,
      target_id: article_id,
      community_id: community_id,
      subject_ref: subject_ref,
      ai_source_ref: request_id,
      sus_notes: [],
      summary: "review"
    }

    assert {:ok, {:ok, item}} =
             Repo.transaction(fn ->
               AlertWall.add_in_transaction(attrs, Ecto.UUID.generate())
             end)

    item
  end
end
