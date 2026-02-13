defmodule GroupherServer.Test.Helper.GQLTest do
  @moduledoc false

  use GroupherServerWeb.ConnCase, async: true

  alias Helper.GQL
  import Helper.ErrorCode, only: [ecode: 1]

  describe "result/1" do
    test "passes through ok" do
      assert {:ok, :pass} = GQL.result({:ok, :pass})
    end

    test "encodes domain error" do
      code = ecode(:not_exist)
      assert {:error, [message: "not_exist", code: ^code]} = GQL.result({:error, :not_exist})
    end

    test "passes through graphQL error" do
      assert {:error, [message: "oops", code: 4001]} =
               GQL.result({:error, [message: "oops", code: 4001]})
    end
  end
end
