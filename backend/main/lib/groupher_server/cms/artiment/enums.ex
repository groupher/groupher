defmodule GroupherServer.CMS.Artiment.Enums do
  @moduledoc """
  Canonical category and workflow-status values shared by CMS artiments.

  Compile-time macros feed Absinthe enum declarations, while runtime accessors
  feed changesets and validators. Both surfaces return the same atom values so
  GraphQL and persistence cannot drift.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Enums
        -> Repo / domain event
  """

  @type cat_enum :: :idea | :bug | :qa | :discussion

  @type status_enum ::
          :default
          | :backlog
          | :todo
          | :wip
          | :done
          | :resolved
          | :reject
          | :reject_dup
          | :reject_no_plan
          | :reject_repro
          | :reject_stale

  # Single source of truth for article category/status enums.
  #
  # Internal values stay as lowercase atoms:
  #   [:idea, :bug]
  #
  # Absinthe exposes IDEA / BUG over GraphQL by default and maps them
  # back to the same lowercase atoms above automatically.
  @cat [:idea, :bug, :qa, :discussion]

  @status [
    :default,
    :backlog,
    :todo,
    :wip,
    :done,
    :resolved,
    :reject,
    :reject_dup,
    :reject_no_plan,
    :reject_repro,
    :reject_stale
  ]

  # compile-time constants (for Absinthe Schema)
  defmacro cat, do: @cat

  @doc "Expands the canonical workflow-status atoms at compile time for Absinthe schemas."
  defmacro status, do: @status

  # optional: runtime access (for non-macro call sites like validations)
  def cat_values, do: @cat

  @doc "Returns the canonical workflow-status atoms for runtime validation."
  def status_values, do: @status
end
