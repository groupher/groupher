defmodule GroupherServer.Test.Helper.ORMUpsert do
  @moduledoc false

  use GroupherServer.TestTools

  alias Accounts.Model.Customization
  alias Helper.ORM

  describe "upsert helpers" do
    test "upsert_by inserts then updates by conflict target" do
      {:ok, user} = db_insert(:user)

      assert {:ok, created} =
               ORM.upsert_by(Customization, [user_id: user.id], %{user_id: user.id, theme: "dark"})

      assert created.user_id == user.id

      assert {:ok, updated} =
               ORM.upsert_by(Customization, [user_id: user.id], %{
                 user_id: user.id,
                 theme: "light"
               })

      assert updated.user_id == user.id
      assert updated.theme == "light"

      assert {:ok, 1} =
               ORM.count(from(c in Customization, where: c.user_id == ^user.id))
    end

    test "insert_or_ignore is idempotent on conflict" do
      {:ok, user} = db_insert(:user)

      assert {:ok, _} =
               ORM.insert_or_ignore(Customization, %{user_id: user.id, theme: "dark"},
                 conflict_target: [:user_id]
               )

      assert {:ok, _} =
               ORM.insert_or_ignore(Customization, %{user_id: user.id, theme: "light"},
                 conflict_target: [:user_id]
               )

      assert {:ok, customization} = ORM.find_by(Customization, user_id: user.id)
      assert customization.theme == "dark"
    end
  end
end
