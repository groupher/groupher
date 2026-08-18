defmodule GroupherServer.CMS.Interactions.Const do
  @moduledoc """
  Canonical order vocabulary accepted by the Interaction query scope.

      Article Reader
        -> Interactions.Const
        -> Interactions.Scope
        -> Ecto query
  """

  @interaction_orders [:upvotes, :collects]
  @passthrough_orders [:publish, :comments, :views]
  @orders @passthrough_orders ++ @interaction_orders

  @doc """
  Returns orders compiled from Interaction read state.

  ## Examples

      Const.interaction_order_values()
      #=> [:upvotes, :collects]

  """
  @spec interaction_order_values() :: [:upvotes | :collects]
  def interaction_order_values, do: @interaction_orders

  @doc """
  Returns validated orders owned by another Article query compiler.

  ## Examples

      Const.passthrough_order_values()
      #=> [:publish, :comments, :views]

  """
  @spec passthrough_order_values() :: [:publish | :comments | :views]
  def passthrough_order_values, do: @passthrough_orders

  @doc """
  Returns the complete non-nil Article order vocabulary.

  ## Examples

      Const.order_values()

  """
  @spec order_values() :: [atom()]
  def order_values, do: @orders

  @doc """
  Returns the order vocabulary as quoted AST for compile-time GraphQL enums.

  ## Examples

      require Const
      Const.order_values_ast()

  """
  defmacro order_values_ast, do: Macro.escape(@orders)

  @doc """
  Checks an order without allowing callers to duplicate the vocabulary.

  ## Examples

      Const.valid_order?(:upvotes)
      #=> true

  """
  @spec valid_order?(atom() | nil) :: boolean()
  def valid_order?(nil), do: true
  def valid_order?(order), do: order in @orders
end
