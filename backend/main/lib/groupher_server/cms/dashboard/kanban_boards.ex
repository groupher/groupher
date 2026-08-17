defmodule GroupherServer.CMS.Dashboard.KanbanBoards do
  @moduledoc """
  Shared kanban board whitelist and defaults for dashboard layout.

  Business position:

      Dashboard UI
        -> GraphQL
        -> CMS.Dashboard
        -> KanbanBoards
        -> CommunityDashboard / Repo
  """

  @type board :: :backlog | :todo | :wip | :done | :rejected

  # Single source of truth for dashboard kanban board enums.
  #
  # Example:
  # - Ecto.Enum list values: [:backlog, :todo, :wip]
  # - GraphQL enum values: BACKLOG / TODO / WIP
  @values [:backlog, :todo, :wip, :done, :rejected]
  @default_values [:todo, :wip, :done]

  @doc "Expands to the full kanban board whitelist at compile time."
  defmacro values, do: @values
  @doc "Expands to the default kanban board set at compile time."
  defmacro default_values, do: @default_values

  @doc "Returns the full kanban board whitelist as a list."
  def values_list, do: @values
  @doc "Returns the default kanban board set as a list."
  def default_values_list, do: @default_values
end
