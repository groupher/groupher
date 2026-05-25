defmodule GroupherServer.CMS.Dashboard.BaseInfo do
  @moduledoc false

  @community_fields [:title, :locale, :desc, :logo, :favicon, :slug, :homepage]

  def community_fields, do: @community_fields

  def take_community_fields(args), do: Map.take(args, @community_fields)
end
