defmodule GroupherServer.CMS.Helper.KanbanBoards do
  @moduledoc """
  Shared kanban board whitelist and defaults for dashboard layout.
  """

  @type board :: :backlog | :todo | :wip | :done | :rejected

  @values [:backlog, :todo, :wip, :done, :rejected]
  @default_values [:todo, :wip, :done]

  defmacro values, do: @values
  defmacro default_values, do: @default_values

  def values_list, do: @values
  def default_values_list, do: @default_values
end
