defmodule GroupherServer.Test.Helper.GQLErrorTest do
  @moduledoc false

  use GroupherServerWeb.ConnCase, async: true

  alias Helper.GQLError
  import Helper.ErrorCode, only: [ecode: 1]

  describe "encode/1" do
    test "encodes atom reason" do
      code = ecode(:not_exist)

      assert {:error, [message: "not_exist", code: ^code]} = GQLError.encode(:not_exist)
    end

    test "encodes reason with binary meta" do
      message = "max 3 pinned comments"
      code = ecode(:comment_pin_limit)

      assert {:error, [message: ^message, code: ^code]} =
               GQLError.encode({:comment_pin_limit, message})
    end

    test "raises for unknown reason in test env" do
      assert_raise ArgumentError, ~r/unknown error reason/, fn ->
        GQLError.encode(:unknown_reason_for_test)
      end
    end
  end
end
