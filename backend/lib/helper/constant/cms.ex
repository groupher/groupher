defmodule Helper.Constant.CMS do
  @moduledoc """
  constant used for CMS

  NOTE: DO NOT modify, unless you know what you are doing
  """

  import Helper.Utils.Map, only: [reverse_kv: 1]

  @artiment_legal 0
  @artiment_illegal 1
  @artiment_audit_failed 2

  @community_normal 0
  @community_applying 1

  @apply_web "WEB"

  @article_cat_map %{
    feature: 1,
    bug: 2,
    question: 3,
    other: 4
  }

  @article_state_map %{
    default: 1,
    todo: 2,
    wip: 3,
    done: 4,
    # for question cat
    resolved: 5,
    reject: 6,
    reject_dup: 7,
    reject_no_plan: 8,
    reject_repro: 9,
    reject_stale: 10
  }

  @article_cat_value_map reverse_kv(@article_cat_map)
  @article_state_value_map reverse_kv(@article_state_map)

  def pending(:legal), do: @artiment_legal
  def pending(:illegal), do: @artiment_illegal
  def pending(:audit_failed), do: @artiment_audit_failed

  def pending(:normal), do: @community_normal
  def pending(:applying), do: @community_applying

  def apply_category(:web), do: @apply_web

  def article_cat, do: @article_cat_map

  def article_cat_value(cat) do
    @article_cat_value_map |> Map.get(cat) |> to_string |> String.upcase()
  end

  def article_state, do: @article_state_map

  def article_state_value(state) do
    @article_state_value_map |> Map.get(state) |> to_string |> String.upcase()
  end
end
