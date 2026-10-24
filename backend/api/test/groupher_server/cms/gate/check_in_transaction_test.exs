defmodule GroupherServer.CMS.Gate.CheckInTransactionTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias GroupherServer.ErrorCat
  alias CMS.Gate
  alias ErrorCat.Error
  alias CMS.Model.Community

  test "fails closed when called outside a runner transaction" do
    assert {:error, %Error{namespace: {:cms, :gate}, reason: :gate_transaction_required}} =
             Gate.check_in_transaction(:system, :edit, %Community{id: 1})
  end
end
