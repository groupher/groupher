defmodule GroupherServer.CMS.Dashboard.BaseInfo do
  @moduledoc """
  Declares dashboard base-info fields that mirror `Community` fields.

  Base info is edited from the dashboard, but some fields also belong to the
  canonical community record. `Dashboard.Write` uses this helper to split those
  fields from section-only payload before saving.
  """

  @community_fields [:title, :locale, :desc, :logo, :favicon, :slug, :homepage]

  def community_fields, do: @community_fields

  def take_community_fields(args), do: Map.take(args, @community_fields)
end
