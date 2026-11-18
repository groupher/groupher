defmodule GroupherServer.Test.CMS.Communities.AdminRequestRulesTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Communities.Admins.Requests.Rules
  alias GroupherServer.CMS.Model.CommunityAdminRequest

  test "apply may approve a dependent subset; invite accepts exactly its proposal" do
    proposed = %{"doc.queue.preview" => true, "doc.queue.write" => true}
    request = %CommunityAdminRequest{type: :apply, proposed_permissions: proposed}

    assert {:ok, %{"doc.queue.preview" => true}} =
             Rules.approve(request, %{"doc.queue.preview" => true})

    assert {:error, :approval_outside_proposal} =
             Rules.approve(request, %{"doc.queue.approve" => true})

    assert {:error, _} = Rules.approve(request, %{"admin.invite" => true})

    invite = %{request | type: :invite}
    assert {:ok, ^proposed} = Rules.approve(invite, proposed)

    assert {:error, :approval_outside_proposal} =
             Rules.approve(invite, %{"doc.queue.preview" => true})
  end

  test "expiry applies at the deadline only to pending requests" do
    now = DateTime.utc_now(:second)
    pending = %CommunityAdminRequest{status: :pending, expires_at: now}
    assert {:ok, true} = Rules.expired?(pending, now)
    assert {:ok, false} = Rules.expired?(pending, DateTime.add(now, -1))
    assert {:ok, false} = Rules.expired?(%{pending | status: :decided}, now)
    pending = %{pending | revision: 3}
    assert {:error, :request_expired} = Rules.pending(pending, 3, now)
    assert {:error, :request_revision_conflict} = Rules.pending(pending, 2, DateTime.add(now, -1))
    assert {:ok, :pass} = Rules.pending(pending, 3, DateTime.add(now, -1))

    assert {:error, :request_already_decided} =
             Rules.pending(%{pending | status: :decided}, 3, now)
  end
end
