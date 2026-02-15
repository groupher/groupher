defmodule Helper.Constant.CMS do
  @moduledoc """
  constant used for CMS

  NOTE: DO NOT modify, unless you know what you are doing
  """

  alias GroupherServer.CMS.Helper.ArticleEnums

  @artiment_legal 0
  @artiment_illegal 1
  @artiment_audit_failed 2

  @community_normal 0
  @community_applying 1

  @apply_web "WEB"

  @article_cat_map ArticleEnums.cat_values() |> Enum.into(%{}, &{&1, &1})
  @article_state_map ArticleEnums.state_values() |> Enum.into(%{}, &{&1, &1})

  def pending(:legal), do: @artiment_legal
  def pending(:illegal), do: @artiment_illegal
  def pending(:audit_failed), do: @artiment_audit_failed

  def pending(:normal), do: @community_normal
  def pending(:applying), do: @community_applying

  def apply_category(:web), do: @apply_web

  def article_cat, do: @article_cat_map

  def article_state, do: @article_state_map
end
