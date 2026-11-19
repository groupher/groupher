defmodule GroupherServer.Test.CMS.Passport.GlobalPassportTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.GlobalPassport
  alias CMS.Passport.Store

  test "global facts are unique per user and retain a positive revision" do
    {:ok, user} = db_insert(:user)

    assert {:ok, passport} =
             %GlobalPassport{}
             |> GlobalPassport.changeset(%{user_id: user.id})
             |> Repo.insert()

    assert passport.permissions == %{}
    refute passport.is_root
    assert passport.revision == 1

    assert {:error, duplicate} =
             %GlobalPassport{}
             |> GlobalPassport.changeset(%{user_id: user.id})
             |> Repo.insert(mode: :savepoint)

    assert Keyword.has_key?(duplicate.errors, :user_id)

    assert {:error, _} =
             Ecto.Adapters.SQL.query(
               Repo,
               "UPDATE cms.global_passports SET revision = 0 WHERE id = $1",
               [Ecto.UUID.dump!(passport.id)],
               mode: :savepoint
             )
  end

  test "global grants enforce catalog and compare the identity and revision" do
    {:ok, user} = db_insert(:user)
    {:ok, other} = db_insert(:user)
    permission = "category.create"

    assert {:error, :transaction_required} =
             Store.grant_global_in_transaction(user.id, nil, %{permission => true})

    assert {:ok, {:ok, first}} =
             Repo.transaction(fn ->
               Store.grant_global_in_transaction(user.id, nil, %{permission => true})
             end)

    assert first.permissions == %{permission => true}

    assert {:ok, {:error, :permission_revision_conflict}} =
             Repo.transaction(fn -> Store.revoke_global_in_transaction(user.id, nil, []) end)

    refute first.is_root

    assert {:ok, {:error, :permission_revision_conflict}} =
             Repo.transaction(fn ->
               Store.grant_global_in_transaction(user.id, nil, %{permission => true})
             end)

    assert {:ok, {:error, :permission_scope_mismatch}} =
             Repo.transaction(fn ->
               Store.grant_global_in_transaction(other.id, first, %{permission => true})
             end)

    assert {:ok, {:error, :permission_scope_mismatch}} =
             Repo.transaction(fn ->
               Store.grant_global_in_transaction(user.id, first, %{"article.update" => true})
             end)

    assert {:ok, {:ok, second}} =
             Repo.transaction(fn ->
               Store.grant_global_in_transaction(user.id, first, %{"category.delete" => true})
             end)

    assert second.revision == 2

    assert {:ok, {:error, :permission_revision_conflict}} =
             Repo.transaction(fn ->
               Store.revoke_global_in_transaction(user.id, first, [permission])
             end)

    assert Repo.get!(GlobalPassport, first.id).permissions == %{
             permission => true,
             "category.delete" => true
           }
  end
end
