defmodule GroupherServerWeb.Schema.CMS.Dashboard.Metrics.Inputs do
  @moduledoc """
  GraphQL dashboard input types.
  """
  use Absinthe.Schema.Notation

  import GroupherServerWeb.Schema.Helper.Fields, only: [dsb_gq_fields: 1, dsb_input_fields: 1]

  input_object :social_info do
    field(:platform, :string)
    field(:link, :string)
  end

  input_object :app_store_info do
    field(:platform, :string)
    field(:link, :string)
  end

  input_object :dsb_alias_map do
    dsb_gq_fields(:name_alias)
  end

  input_object :dsb_link_child_map do
    field(:id, non_null(:string))
    field(:title, non_null(:string))
    field(:url, non_null(:string))
  end

  input_object :dsb_link_map do
    field(:id, non_null(:string))
    field(:type, non_null(:dsb_link_type))
    field(:title, non_null(:string))
    field(:url, :string)
    field(:links, list_of(:dsb_link_child_map))
  end

  input_object :dsb_social_link_map do
    dsb_gq_fields(:social_link)
  end

  input_object :dsb_media_report_map do
    dsb_gq_fields(:media_report)
  end

  input_object :dsb_wallpaper_input do
    dsb_input_fields(:wallpaper)
  end
end
