defmodule Helper.Constant.CMS do
  @moduledoc """
  constant used for CMS

  NOTE: DO NOT modify, unless you know what you are doing
  """

  alias GroupherServer.CMS.Artiment.Enums

  @artiment_legal 0
  @artiment_illegal 1
  @artiment_audit_failed 2

  @community_normal 0
  @community_applying 1

  @apply_web "WEB"

  @article_cat_map Enums.cat_values() |> Enum.into(%{}, &{&1, &1})
  @article_status_map Enums.status_values() |> Enum.into(%{}, &{&1, &1})

  def pending(:legal), do: @artiment_legal
  def pending(:illegal), do: @artiment_illegal
  def pending(:audit_failed), do: @artiment_audit_failed

  def pending(:normal), do: @community_normal
  def pending(:applying), do: @community_applying

  def apply_category(:web), do: @apply_web

  def article_cat, do: @article_cat_map

  def article_status, do: @article_status_map
end
