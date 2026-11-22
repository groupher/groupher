defmodule GroupherServer.CMS.ProductionSeed.PrivilegesTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.GlobalPassport
  alias CMS.ProductionSeed.Privileges

  test "temporary root is visible only inside the transaction and restores the original row" do
    {:ok, user} = db_insert(:user)

    assert {:ok, :done} =
             Repo.transaction(fn ->
               Privileges.with_temporary_root!(user.id, fn ->
                 assert {:ok, %{is_root: true}} = CMS.Passport.global_facts(user.id)
                 :done
               end)
             end)

    assert Repo.get_by(GlobalPassport, user_id: user.id) == nil

    {:ok, row} =
      %GlobalPassport{}
      |> GlobalPassport.changeset(%{user_id: user.id, permissions: %{"community.create" => true}})
      |> Repo.insert()

    assert {:ok, :done} =
             Repo.transaction(fn ->
               Privileges.with_temporary_root!(user.id, fn ->
                 assert {:ok, %{is_root: true}} = CMS.Passport.global_facts(user.id)
                 :done
               end)
             end)

    assert Repo.get!(GlobalPassport, row.id) == row
  end

  test "failure or an unexpected mutation rolls back the temporary privilege" do
    {:ok, user} = db_insert(:user)

    assert {:error, :abort} =
             Repo.transaction(fn ->
               Privileges.with_temporary_root!(user.id, fn -> Repo.rollback(:abort) end)
             end)

    refute Repo.get_by(GlobalPassport, user_id: user.id)

    assert {:error, :returned_failure} =
             Repo.transaction(fn ->
               Privileges.with_temporary_root!(user.id, fn -> {:error, :returned_failure} end)
             end)

    refute Repo.get_by(GlobalPassport, user_id: user.id)

    assert {:error, :seed_permissions_changed} =
             Repo.transaction(fn ->
               Privileges.with_temporary_root!(user.id, fn ->
                 row = Repo.get_by!(GlobalPassport, user_id: user.id)

                 row
                 |> Ecto.Changeset.change(permissions: %{"community.create" => true})
                 |> Repo.update!()
               end)
             end)

    refute Repo.get_by(GlobalPassport, user_id: user.id)
  end

  test "invalid BodyBag is rejected before temporary authority" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    manifest = %{"communities" => %{"site" => community.id}, "resources" => %{}}

    assert {:error, :seed_invalid_mention_targets} =
             Repo.transaction(fn ->
               Privileges.lock_resources!(manifest, [{%{"json" => "not json"}, community.id}])
               Privileges.with_temporary_root!(user.id, fn -> :done end)
             end)

    refute Repo.get_by(GlobalPassport, user_id: user.id)
  end
end
