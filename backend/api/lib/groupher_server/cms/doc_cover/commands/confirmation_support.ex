defmodule GroupherServer.CMS.DocCover.Commands.ConfirmationSupport do
  @moduledoc """
  Builds and presents the small JSON-safe result envelope used by DocCover
  receipt-backed commands.

      Persist result
        -> normalized result map
        -> DocCoverConfirmation
        -> GraphQL-compatible result on first call or replay
  """

  alias GroupherServer.CMS.DocCover.Commands.DocCoverConfirmation

  @doc "Wraps a DocCover result with the command identity for Receipt storage."
  @spec confirmation(term(), Ecto.UUID.t()) :: DocCoverConfirmation.t()
  def confirmation(result, command_id) do
    %DocCoverConfirmation{
      data: %{
        "command_id" => command_id,
        "operation_result" => normalize_result(result)
      }
    }
  end

  @doc "Presents a stored DocCover confirmation as the original result shape."
  @spec present({:ok, DocCoverConfirmation.t()} | {:error, term()}) ::
          {:ok, term()} | {:error, term()}
  def present({:ok, %DocCoverConfirmation{data: %{"operation_result" => result}}}),
    do: {:ok, restore_result(result)}

  def present(error), do: error

  defp normalize_result(%{__struct__: GroupherServer.CMS.Model.DocCoverPinnedDoc} = result) do
    result
    |> Map.take([:community_id, :node_id, :index, :appearance])
    |> normalize_result()
  end

  defp normalize_result(%{__struct__: _} = result), do: result |> Map.from_struct() |> normalize_result()

  defp normalize_result(map) when is_map(map) and not is_struct(map) do
    Map.new(map, fn {key, value} -> {to_string(key), normalize_nested(value)} end)
  end

  defp normalize_result(value), do: normalize_nested(value)

  defp normalize_nested(value) when is_map(value) and not is_struct(value) do
    Map.new(value, fn {key, nested} -> {to_string(key), normalize_nested(nested)} end)
  end

  defp normalize_nested(value) when is_list(value), do: Enum.map(value, &normalize_nested/1)
  defp normalize_nested(value), do: value

  defp restore_result(map) when is_map(map) do
    Map.new(map, fn {key, value} -> {restore_key(key), value} end)
  end

  defp restore_result(value), do: value

  defp restore_key(key) when key in ~w(id community_id group_node_id node_id index appearance title),
    do: String.to_existing_atom(key)

  defp restore_key(key), do: key
end
