defmodule GroupherServer.CMS.Artiment.Const do
  @moduledoc """
  Closed category, workflow-status, and moderation vocabulary shared by CMS artiments.

      Article/comment domain -> Artiment.Const -> schema and query semantics
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

  @cats [:idea, :bug, :qa, :discussion]
  @statuses [
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
  @moderation_states %{legal: 0, illegal: 1, audit_failed: 2}

  @spec cat_values() :: [cat_enum()]
  def cat_values, do: @cats

  @spec status_values() :: [status_enum()]
  def status_values, do: @statuses

  @spec moderation_state(:legal | :illegal | :audit_failed) :: 0 | 1 | 2
  def moderation_state(state), do: Map.fetch!(@moderation_states, state)

  @spec cat_map() :: %{atom() => atom()}
  def cat_map, do: Map.new(@cats, &{&1, &1})

  @spec status_map() :: %{atom() => atom()}
  def status_map, do: Map.new(@statuses, &{&1, &1})

  defmacro cat_values_ast, do: Macro.escape(@cats)
  defmacro status_values_ast, do: Macro.escape(@statuses)
end
