defmodule GroupherServer.Test.CMS.Gate.Scope.CommunityTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  require CMS.Const

  alias CMS.Model.{Community, CommunityLifecycle}
  alias CMS.Gate.Context.Scope.Community, as: CommunityScope

  defp to_sql(query), do: Ecto.Adapters.SQL.to_sql(:all, Repo, query)

  test "Community scope compiles the public lifecycle boundary" do
    query = CMS.Gate.scope(Community, nil, :read, CommunityScope.public())
    assert %Ecto.Query{} = query

    {sql, params} = to_sql(query)

    assert sql =~ ~s(LEFT OUTER JOIN "cms"."community_lifecycles")
    assert ["active", "read_only"] in params
  end

  test "scope rejects an omitted policy mode instead of defaulting to public" do
    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_context_missing}} =
             CMS.Gate.scope(Community, nil, :read, %{})

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_context_missing}} =
             CMS.Gate.scope(Post, nil, :read, %{thread: :post})
  end

  test "Community scope requires explicit owner management mode for restricted states" do
    {:ok, owner} = db_insert(:user)

    owner_query =
      CMS.Gate.scope(Community, owner, :read, CommunityScope.owner_management())

    assert %Ecto.Query{} = owner_query

    {owner_sql, owner_params} = to_sql(owner_query)
    assert owner_sql =~ "user_id"

    assert [
             "setting_up",
             "setup_failed",
             "active",
             "read_only",
             "suspended",
             "archived",
             "pending_destroy"
           ] in owner_params

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_policy_actor_mismatch}} =
             CMS.Gate.scope(Community, nil, :read, CommunityScope.owner_management())

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_policy_actor_mismatch}} =
             CMS.Gate.scope(Community, owner, :read, CommunityScope.operations())
  end

  test "Community scope compiles moderator and operations modes explicitly" do
    {:ok, moderator} = db_insert(:user)

    moderator_query =
      CMS.Gate.scope(Community, moderator, :list, CommunityScope.moderator_management())

    assert %Ecto.Query{} = moderator_query
    {moderator_sql, _moderator_params} = to_sql(moderator_query)
    assert moderator_sql =~ "communities_moderators"
    assert moderator_sql =~ "exists("

    operations_query =
      CMS.Gate.scope(Community, :operations, :read, CommunityScope.operations())

    assert %Ecto.Query{} = operations_query
    {_operations_sql, operations_params} = to_sql(operations_query)

    assert [
             "setting_up",
             "setup_failed",
             "active",
             "read_only",
             "suspended",
             "archived",
             "pending_destroy",
             "destroy"
           ] in operations_params
  end

  test "Community owner public read never bypasses Lifecycle terminal states" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    for state <- CMS.Const.lifecycle_state_values() do
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: state})
      |> Repo.update!()

      public_query =
        CMS.Gate.scope(Community, owner, :read, CommunityScope.public())
        |> where([candidate], candidate.id == ^community.id)

      management_query =
        CMS.Gate.scope(Community, owner, :read, CommunityScope.owner_management())
        |> where([candidate], candidate.id == ^community.id)

      assert Repo.exists?(public_query) == state in [:active, :read_only]
      assert Repo.exists?(management_query) == (state != :destroy)
    end
  end

  test "scope rejects unsupported roots, actions, and reserved bindings" do
    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_root_mismatch}} =
             CMS.Gate.scope(CommunityLifecycle, nil, :read, CommunityScope.public())

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :unknown_action}} =
             CMS.Gate.scope(Community, nil, :publish, CommunityScope.public())

    query =
      from(community in Community,
        left_join: lifecycle in CommunityLifecycle,
        as: :gate_lifecycle,
        on: lifecycle.community_id == community.id
      )

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_binding_conflict}} =
             CMS.Gate.scope(query, nil, :read, CommunityScope.public())
  end

  test "Community scope rejects named and anonymous lifecycle joins" do
    direct_join =
      from(community in Community,
        left_join: lifecycle in CommunityLifecycle,
        on: lifecycle.community_id == community.id
      )

    association_join =
      from(community in Community,
        left_join: lifecycle in assoc(community, :lifecycle)
      )

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_binding_conflict}} =
             CMS.Gate.scope(direct_join, nil, :read, CommunityScope.public())

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_binding_conflict}} =
             CMS.Gate.scope(association_join, nil, :read, CommunityScope.public())
  end
end
