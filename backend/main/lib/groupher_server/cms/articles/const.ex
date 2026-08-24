defmodule GroupherServer.CMS.Articles.Const do
  @moduledoc """
  Closed Article list-order vocabulary exposed at the CMS boundary.

      Article query input -> Articles.Const -> Article list ordering
  """

  alias GroupherServer.CMS.Interactions.Const, as: InteractionsConst

  @native_orders [:publish, :comments, :views]
  @orders @native_orders ++ InteractionsConst.interaction_order_values()

  @spec order_values() :: [atom()]
  def order_values, do: @orders

  @spec native_order_values() :: [atom()]
  def native_order_values, do: @native_orders

  defmacro order_values_ast, do: Macro.escape(@orders)

  @spec valid_order?(atom() | nil) :: boolean()
  def valid_order?(nil), do: true
  def valid_order?(order), do: order in @orders
end
