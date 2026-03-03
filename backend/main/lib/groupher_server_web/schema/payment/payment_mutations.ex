defmodule GroupherServerWeb.Schema.Payment.Mutations do
  @moduledoc """
  billing mutations
  """
  use Helper.GqlSchemaSuite

  object :payment_mutations do
    @desc "create bill"
    field :create_bill, :bill do
      arg(:payment_method, non_null(:payment_method_enum))
      arg(:payment_usage, non_null(:payment_usage_enum))
      arg(:amount, non_null(:float))
      arg(:note, :string)

      middleware(M.Authorize, :login)
      resolve(&R.Payment.create_bill/3)
    end

    @desc "update user's bill state"
    field :update_bill_state, :bill do
      arg(:id, non_null(:id))
      arg(:state, non_null(:bill_state_enum))

      middleware(M.Authorize, :login)
      middleware(M.Passport, action: "billing.state.update")

      resolve(&R.Payment.update_bill_state/3)
    end
  end
end
