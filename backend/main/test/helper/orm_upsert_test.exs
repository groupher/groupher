defmodule GroupherServer.Test.Helper.ORMUpsert do
  @moduledoc false

  use GroupherServer.TestMate

  alias Accounts.Model.Achievement
  alias Helper.ORM

  describe "upsert helpers" do
    test "upsert_by inserts then updates by conflict target" do
      {:ok, user} = db_insert(:user)

      assert {:ok, created} =
               ORM.upsert_by(Achievement, [user_id: user.id], %{user_id: user.id, reputation: 1})

      assert created.user_id == user.id

      assert {:ok, updated} =
               ORM.upsert_by(Achievement, [user_id: user.id], %{
                 user_id: user.id,
                 reputation: 2
               })

      assert updated.user_id == user.id
      assert updated.reputation == 2

      assert {:ok, 1} =
               ORM.count(from(a in Achievement, where: a.user_id == ^user.id))
    end

    test "insert_or_ignore is idempotent on conflict" do
      {:ok, user} = db_insert(:user)

      assert {:ok, _} =
               ORM.insert_or_ignore(Achievement, %{user_id: user.id, reputation: 1},
                 conflict_target: [:user_id]
               )

      assert {:ok, _} =
               ORM.insert_or_ignore(Achievement, %{user_id: user.id, reputation: 2},
                 conflict_target: [:user_id]
               )

      assert {:ok, achievement} = ORM.find_by(Achievement, user_id: user.id)
      assert achievement.reputation == 1
    end
  end
end
