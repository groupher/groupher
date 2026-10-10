defmodule GroupherServerWeb.Schema.CMS.Dashboard.Metrics.Inputs do
  @moduledoc """
  GraphQL dashboard input types.

  Business position:

      Client
        -> Absinthe schema / Inputs
        -> resolver or domain context
        -> GraphQL response
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

  input_object :dsb_bg_config_input do
    dsb_input_fields(:wallpaper_bg)
  end

  input_object :custom_wallpaper_input do
    field(:type, non_null(:custom_wallpaper_type))
    field(:asset_public_ref, :string)
    field(:config, non_null(:json))
  end

  input_object :wallpaper_settings_input do
    field(:settings_schema_version, non_null(:integer))
    field(:type, non_null(:wallpaper_type))
    field(:source, :string)
    field(:custom_wallpaper, :custom_wallpaper_input)
    field(:render_config, :json)
  end

  input_object :wallpaper_publish_input do
    field(:theme, non_null(:wallpaper_theme))
    field(:settings, non_null(:wallpaper_settings_input))
    field(:base_version, non_null(:integer))
    field(:command_id, non_null(:id))
    field(:batch_ref, :string)
  end

  input_object :wallpaper_image_input do
    field(:profile, non_null(:wallpaper_profile))
    field(:checksum, non_null(:string))
    field(:mime_type, non_null(:string))
    field(:size_bytes, non_null(:integer))
    field(:width, non_null(:integer))
    field(:height, non_null(:integer))
  end

  input_object :wallpaper_upload_prepare_input do
    field(:theme, non_null(:wallpaper_theme))
    field(:settings, non_null(:wallpaper_settings_input))
    field(:base_version, non_null(:integer))
    field(:command_id, non_null(:id))
    field(:images, non_null(list_of(non_null(:wallpaper_image_input))))
  end

  input_object :wallpaper_restore_snapshot_input do
    field(:snapshot_id, non_null(:id))
    field(:base_version, non_null(:integer))
  end
end
