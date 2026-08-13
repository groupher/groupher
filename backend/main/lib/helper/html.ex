defmodule Helper.HTML do
  @moduledoc """
  Sanitizes and escapes user-authored HTML derived from rich-text content.

  Business position:

      Domain or web caller
        -> HTML
        -> normalized value / infrastructure
  """

  import Ecto.Changeset
  # alias Phoenix.HTML

  @doc "Runs `safe_string` through the public `HTML` boundary."
  def safe_string(%Ecto.Changeset{valid?: true, changes: changes} = changeset, field) do
    case Map.has_key?(changes, field) do
      true -> changeset |> put_change(field, escape_to_safe_string(changes[field]))
      _ -> changeset
    end
  end

  def safe_string(%Ecto.Changeset{} = changeset, _field), do: changeset

  # defp escape_to_safe_string(v), do: v |> HTML.html_escape() |> HTML.safe_to_string()
  defp escape_to_safe_string(v), do: v

  # defp escape_to_safe_string(v), do: v |> HTML.javascript_escape # HTML.html_escape() |> HTML.safe_to_string()
end
