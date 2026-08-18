defmodule Helper.Constant.CMS do
  @moduledoc """
  Canonical CMS limits, defaults, and thread-related constants.

  NOTE: DO NOT modify, unless you know what you are doing

  Business position:

      Domain or web caller
        -> CMS
        -> normalized value / infrastructure
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

  @doc "Runs `pending` through the public `CMS` boundary."
  def pending(:legal), do: @artiment_legal
  def pending(:illegal), do: @artiment_illegal
  def pending(:audit_failed), do: @artiment_audit_failed

  def pending(:normal), do: @community_normal
  def pending(:applying), do: @community_applying

  @doc "Runs `apply_category` through the public `CMS` boundary."
  def apply_category(:web), do: @apply_web

  @doc "Runs `article_cat` through the public `CMS` boundary."
  def article_cat, do: @article_cat_map

  @doc "Runs `article_status` through the public `CMS` boundary."
  def article_status, do: @article_status_map
end
