defmodule GroupherServer.CMS.Helper.KanbanBoards do
  @moduledoc """
  Shared kanban board whitelist and defaults for dashboard layout.
  """

  @type board :: :backlog | :todo | :wip | :done | :rejected

  # Single source of truth for dashboard kanban board enums.
  #
  # Example:
  # - Ecto.Enum list values: [:backlog, :todo, :wip]
  # - GraphQL enum values: backlog / todo / wip
  @values [:backlog, :todo, :wip, :done, :rejected]
  @default_values [:todo, :wip, :done]

  defmacro values, do: @values
  defmacro default_values, do: @default_values

  def values_list, do: @values
  def default_values_list, do: @default_values
end
