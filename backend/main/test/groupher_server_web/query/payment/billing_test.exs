defmodule GroupherServer.Test.Query.Payment.Basic do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Payment

  setup do
    {:ok, user} = db_insert(:user)
    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    valid_attrs = %{
      amount: 10.24,
      payment_usage: "donate",
      payment_method: "alipay"
    }

    {:ok, ~m(guest_conn user_conn user valid_attrs)a}
  end

  describe "[biling basic]" do
    @query """
    query($filter: PagiFilter!) {
      pagedBillRecords(filter: $filter) {
        entries {
          id
          state
          amount
          hashId
          paymentUsage
          paymentMethod
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "login user can get it's own billing records ", ~m(user_conn user valid_attrs)a do
      {:ok, _record} = Payment.create_record(user, valid_attrs)

      variables = %{filter: %{page: 1, size: 20}}
      results = user_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
    end
  end
end
