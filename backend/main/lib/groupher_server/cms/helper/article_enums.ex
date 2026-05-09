defmodule GroupherServer.CMS.Helper.ArticleEnums do
  @moduledoc """
  article enums for post, blog, doc, changelog
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
  defmacro status, do: @status

  # optional: runtime access (for non-macro call sites like validations)
  def cat_values, do: @cat
  def status_values, do: @status
end
