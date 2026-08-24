defmodule GroupherServer.CMS.Interactions.Const do
  @moduledoc """
  Canonical order vocabulary accepted by the Interaction query scope.

      Article Reader
        -> Interactions.Const
        -> Interactions.Scope
        -> Ecto query
  """

  @interaction_orders [:upvotes, :collects]

  @doc """
  Returns orders compiled from Interaction read state.

  ## Examples

      Const.interaction_order_values()
      #=> [:upvotes, :collects]

  """
  @spec interaction_order_values() :: [:upvotes | :collects]
  def interaction_order_values, do: @interaction_orders

  @doc """
  Checks an order without allowing callers to duplicate the vocabulary.

  ## Examples

      Const.valid_order?(:upvotes)
      #=> true

  """
  @spec valid_order?(atom() | nil) :: boolean()
  def valid_order?(nil), do: true
  def valid_order?(order), do: order in @interaction_orders
end
