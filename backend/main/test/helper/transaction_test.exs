defmodule GroupherServer.Test.Helper.Transaction do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias CMS.Model.Community
  alias Helper.Transaction

  describe "lock_global/2" do
    test "works with string lock key" do
      assert {:ok, :ok} =
               Transaction.lock_global("test:transaction:lock_global:string", fn ->
                 :ok
               end)
    end

    test "works with integer lock key" do
      assert {:ok, :ok} =
               Transaction.lock_global(2_026_030_8, fn ->
                 :ok
               end)
    end

    test "returns business error from callback" do
      assert {:error, :locked_failed} =
               Transaction.lock_global("test:transaction:lock_global:error", fn ->
                 {:error, :locked_failed}
               end)
    end
  end

  describe "lock_row/2" do
    test "locks existing row and returns callback value" do
      {:ok, community} = db_insert(:community)

      assert {:ok, locked_community} =
               Transaction.lock_row(community, fn locked_community ->
                 {:ok, locked_community}
               end)

      assert locked_community.id == community.id
    end

    test "returns resource_not_found for missing row" do
      assert {:error, {:resource_not_found, Community}} =
               Transaction.lock_row(%Community{id: -1}, fn _ -> :ok end)
    end

    test "locks multiple rows in deterministic order" do
      {:ok, community1} = db_insert(:community)
      {:ok, community2} = db_insert(:community)

      expected_ids = [community1.id, community2.id] |> Enum.sort()

      assert {:ok, locked_ids} =
               Transaction.lock_row([community2, community1], fn locked_communities ->
                 locked_communities
                 |> Enum.map(& &1.id)
               end)

      assert locked_ids == expected_ids
    end
  end
end
