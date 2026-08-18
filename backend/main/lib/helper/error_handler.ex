defmodule Helper.ErrorHandler do
  @moduledoc """
  Produces localized not-found messages for ORM and GraphQL error boundaries.

  It derives the public model name and lookup detail without exposing Ecto query
  internals to callers.

  Business position:

      Domain or web caller
        -> ErrorHandler
        -> normalized value / infrastructure
  """
  alias GroupherServerWeb.Gettext, as: Translator

  @doc "Formats a localized not-found message from a scalar identifier or query clauses."
  def not_found_formatter(queryable, id) when is_integer(id) or is_binary(id) do
    model = queryable |> to_string |> String.split(".") |> List.last()

    Translator |> Gettext.dgettext("404", "#{model}(%{id}) not found", id: id)
  end

  def not_found_formatter(queryable, clauses) do
    model = queryable |> to_string |> String.split(".") |> List.last()

    detail =
      clauses
      |> Enum.into(%{})
      |> Map.values()
      |> List.first()
      |> to_string

    Translator |> Gettext.dgettext("404", "#{model}(%{name}) not found", name: detail)
  end
end
