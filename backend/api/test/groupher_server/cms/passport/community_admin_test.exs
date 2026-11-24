defmodule GroupherServer.Test.CMS.Passport.CommunityAdminTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.CommunityAdmin
  alias CMS.Passport
  alias CMS.Passport.Store

  test "Community destroy removes current Admin membership atomically" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    member = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: user.id)
    lifecycle = GroupherServer.CMS.Communities.Lifecycle

    assert {:ok, _} =
             lifecycle.request_destroy(community.id,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             lifecycle.schedule_destroy(community.id, operation_ref: Ecto.UUID.generate())

    assert {:error, :test_rollback} =
             Repo.transaction(fn ->
               assert {:ok, _} =
                        lifecycle.destroy(community.id, operation_ref: Ecto.UUID.generate())

               assert is_nil(Repo.get(CommunityAdmin, member.id))
               Repo.rollback(:test_rollback)
             end)

    assert Repo.get(CommunityAdmin, member.id)
    assert {:ok, _} = lifecycle.destroy(community.id, operation_ref: Ecto.UUID.generate())
    assert is_nil(Repo.get(CommunityAdmin, member.id))
  end

  test "legacy report loads only real membership and does not widen unknown grants" do
    {:ok, user} = db_insert(:user)
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: user.id,
          community_id: community.id
        })
      )

    legacy = GroupherServer.CMS.Model.Passport

    Repo.insert!(
      legacy.changeset(struct(legacy), %{
        user_id: user.id,
        rules: %{
          "global" => %{"god" => true},
          community.slug => %{"root" => true, "cms" => %{"post.community_tag.set" => true}},
          "no-membership" => %{"root" => true}
        }
      })
    )

    assert {:ok, plan} = GroupherServer.CMS.Passport.LegacyPlan.report(user.id)
    assert plan.is_root
    assert plan.communities[community.slug].member_id == member.id
    assert plan.communities[community.slug].is_lord
    assert Enum.any?(plan.exceptions, &(&1.reason == :requires_manual_mapping))
    assert Enum.any?(plan.exceptions, &(&1.reason == :missing_or_ambiguous_membership))
    assert Repo.get!(CommunityAdmin, member.id).is_lord == false
  end

  test "Community lord and Global root respect scope and thread dependencies" do
    {:ok, user} = db_insert(:user)
    {:ok, owner} = db_insert(:user)
    {:ok, x} = mock_community(owner)
    {:ok, y} = mock_community(owner)

    member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: user.id,
          community_id: x.id,
          is_lord: true
        })
      )

    assert {:ok, true} = check(user, x, "doc.queue.write", :doc)
    assert {:ok, false} = check(user, y, "doc.queue.write", :doc)

    assert {:error, :permission_scope_mismatch} =
             check(user, x, "article.update", :doc)

    assert {:error, :unknown_thread} =
             check(user, x, "doc.queue.write", :unknown)

    member
    |> CommunityAdmin.changeset(%{
      is_lord: false,
      permissions: %{
        "community.article.hide" => true,
        "community.article.trash.read" => true
      }
    })
    |> Repo.update!()

    assert {:ok, true} =
             check(user, x, "community.article.hide", :post)

    assert {:ok, false} =
             check(user, x, "community.article.hide", :doc)

    assert {:error, :thread_required} = check(user, x, "community.article.hide")

    Repo.insert!(
      GroupherServer.CMS.Model.GlobalPassport.changeset(
        %GroupherServer.CMS.Model.GlobalPassport{},
        %{user_id: user.id, is_root: true}
      )
    )

    assert {:ok, true} = check(user, y, "doc.queue.write", :doc)
    assert {:error, :thread_required} = check(user, x, "community.article.hide")
    {:ok, scope} = Passport.load_community_scope(user, x)

    assert {:error, :invalid_scope} =
             Passport.allowed_community?(owner, scope, "doc.queue.write", :doc)

    assert {:error, :permission_scope_mismatch} =
             check(user, x, "article.update", :doc)
  end

  test "isolates Community facts and rejects stale member revisions" do
    {:ok, user} = db_insert(:user)
    {:ok, owner} = db_insert(:user)
    {:ok, x} = mock_community(owner)
    {:ok, y} = mock_community(owner)

    x_member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{user_id: user.id, community_id: x.id})
      )

    y_member =
      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{user_id: user.id, community_id: y.id})
      )

    assert {:ok, {:ok, updated_x}} =
             Repo.transaction(fn ->
               Store.grant_community_in_transaction(user.id, x.id, x_member, %{
                 "doc.queue.write" => true
               })
             end)

    assert updated_x.revision == 2

    assert {:ok, %{permissions: %{"doc.queue.write" => true}, member_id: x_id}} =
             Passport.community_facts(user.id, x.id)

    assert x_id == x_member.id
    assert {:ok, %{permissions: %{}, member_id: y_id}} = Passport.community_facts(user.id, y.id)
    assert y_id == y_member.id

    assert {:ok, {:error, :permission_revision_conflict}} =
             Repo.transaction(fn ->
               Store.grant_community_in_transaction(user.id, x.id, x_member, %{
                 "doc.queue.preview" => true
               })
             end)

    assert {:ok, {:error, :permission_scope_mismatch}} =
             Repo.transaction(fn ->
               Store.grant_community_in_transaction(user.id, y.id, updated_x, %{
                 "doc.queue.write" => true
               })
             end)
  end

  defp check(user, community, action, thread \\ nil) do
    {:ok, scope} = Passport.load_community_scope(user, community)
    Passport.allowed_community?(user, scope, action, thread)
  end
end
