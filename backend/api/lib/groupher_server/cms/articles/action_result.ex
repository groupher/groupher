defmodule GroupherServer.CMS.Articles.ActionResult do
  @moduledoc """
  Reconciles stable Article action state into the public projection shape.

      Article state command
        -> canonical stable Article / branch state
        -> caller-facing Article projection
  """

  @doc "Merges canonical operational state and explicit projection fields."
  @spec merge(map(), map(), map()) :: {:ok, map()}
  def merge(article, updated, fields \\ %{}) do
    meta =
      article
      |> Map.get(:meta, %{})
      |> Map.merge(%{
        is_comment_locked: Map.get(updated, :comments_locked),
        is_sunk: Map.get(updated, :is_sunk),
        last_active_at: Map.get(updated, :last_active_at)
      })

    result =
      article
      |> Map.put(:active_at, Map.get(updated, :active_at, Map.get(article, :active_at)))
      |> Map.put(:meta, meta)
      |> Map.merge(fields)

    {:ok, result}
  end
end
