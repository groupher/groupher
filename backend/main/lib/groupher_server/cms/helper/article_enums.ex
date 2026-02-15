defmodule GroupherServer.CMS.Helper.ArticleEnums do
  @moduledoc """
  article enums for post, blog, doc, changelog
  """

  @type cat_enum :: :feature | :bug | :question | :other

  @type state_enum ::
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

  @cat [:feature, :bug, :question, :other]

  @state [
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
  defmacro state, do: @state

  # optional: runtime access (for non-macro call sites like validations)
  def cat_values, do: @cat
  def state_values, do: @state
end
