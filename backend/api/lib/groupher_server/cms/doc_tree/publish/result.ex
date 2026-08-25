defmodule GroupherServer.CMS.DocTree.Publish.Result do
  @moduledoc """
  Small result helpers shared by publish submodules.

      enumerable
          |
          v
      fun.(item)
          |
          +--> {:ok, value} -> keep walking
          +--> error        -> stop immediately
          |
          v
      {:ok, values} | error

  This stays under `Publish` because it is a local control-flow helper, not a
  project-wide result abstraction.
  """

  @doc """
  Maps an enumerable while every function result is `{:ok, value}`.

  Stops at the first non-ok result and returns it unchanged.

  ## Examples

      Result.map_while_ok([1, 2, 3], fn x -> {:ok, x * 2} end)
      #=> {:ok, [2, 4, 6]}

      Result.map_while_ok([1, 2, 3], fn
        2 -> {:error, GroupherServer.ErrorCat.custom("boom")}
        x -> {:ok, x}
      end)
      #=> {:error, %GroupherServer.ErrorCat.Error{reason: :custom}}

  """
  def map_while_ok(enumerable, fun) do
    enumerable
    |> Enum.reduce_while({:ok, []}, fn item, {:ok, acc} ->
      case fun.(item) do
        {:ok, value} -> {:cont, {:ok, [value | acc]}}
        error -> {:halt, error}
      end
    end)
    |> reverse_ok()
  end

  defp reverse_ok({:ok, items}), do: {:ok, Enum.reverse(items)}
  defp reverse_ok(error), do: error
end
