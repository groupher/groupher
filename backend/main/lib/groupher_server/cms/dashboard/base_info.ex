defmodule GroupherServer.CMS.Dashboard.BaseInfo do
  @moduledoc """
  Declares dashboard base-info fields that mirror `Community` fields.

  Base info is edited from the dashboard, but some fields also belong to the
  canonical community record. `Dashboard.Write` uses this helper to split those
  fields from section-only payload before saving.

  Business position:

      Dashboard UI
        -> GraphQL
        -> CMS.Dashboard
        -> BaseInfo
        -> CommunityDashboard / Repo
  """

  @community_fields [:title, :locale, :desc, :logo, :favicon, :slug, :homepage]

  @doc "Returns the dashboard base-info fields that mirror `Community` fields."
  def community_fields, do: @community_fields

  @doc """
  Keeps only the dashboard base-info fields from the given args map.

  ## Examples

      BaseInfo.take_community_fields(%{title: "hello", slug: "hello", random: 1})
      #=> %{title: "hello", slug: "hello"}

  """
  def take_community_fields(args), do: Map.take(args, @community_fields)
end
