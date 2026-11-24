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
    @desc "Social platform identifier."
    field(:platform, :string)
    @desc "URL of the community profile on that platform."
    field(:link, :string)
  end

  input_object :app_store_info do
    @desc "App store identifier."
    field(:platform, :string)
    @desc "URL of the application listing."
    field(:link, :string)
  end

  input_object :dsb_alias_map do
    dsb_gq_fields(:name_alias)
  end

  input_object :dsb_link_child_map do
    @desc "Navigation item identifier."
    field(:id, non_null(:string))
    @desc "Label shown for the link."
    field(:title, non_null(:string))
    @desc "Destination URL."
    field(:url, non_null(:string))
  end

  input_object :dsb_link_map do
    @desc "Navigation item identifier."
    field(:id, non_null(:string))
    @desc "Whether this item is a link or a group."
    field(:type, non_null(:dsb_link_type))
    @desc "Label shown in navigation."
    field(:title, non_null(:string))
    @desc "Destination for a single link."
    field(:url, :string)
    @desc "Child destinations for a link group."
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
    @desc "Kind of custom wallpaper to render."
    field(:type, non_null(:custom_wallpaper_type))
    @desc "Public reference of the source image asset."
    field(:asset_public_ref, :string)
    @desc "Custom settings for the selected wallpaper kind."
    field(:config, non_null(:json))
  end

  input_object :wallpaper_settings_input do
    @desc "Format version of the wallpaper settings."
    field(:settings_schema_version, non_null(:integer))
    @desc "Wallpaper source mode."
    field(:type, non_null(:wallpaper_type))
    @desc "Selected wallpaper source."
    field(:source, :string)
    @desc "Custom gradient or picture settings."
    field(:custom_wallpaper, :custom_wallpaper_input)
    @desc "Parameters used to render the wallpaper."
    field(:render_config, :json)
  end

  input_object :wallpaper_publish_input do
    @desc "Theme whose wallpaper is being published."
    field(:theme, non_null(:wallpaper_theme))
    @desc "Settings to publish for this theme."
    field(:settings, non_null(:wallpaper_settings_input))
    @desc "Expected current wallpaper version."
    field(:base_version, non_null(:integer))
    @desc "Identifier for retrying the same publish command."
    field(:command_id, non_null(:id))
    @desc "Prepared upload batch containing the generated images."
    field(:batch_ref, :string)
  end

  input_object :wallpaper_image_input do
    @desc "Target screen profile."
    field(:profile, non_null(:wallpaper_profile))
    @desc "Checksum of the generated image."
    field(:checksum, non_null(:string))
    @desc "Media type of the generated image."
    field(:mime_type, non_null(:string))
    @desc "Encoded image size in bytes."
    field(:size_bytes, non_null(:integer))
    @desc "Image width in pixels."
    field(:width, non_null(:integer))
    @desc "Image height in pixels."
    field(:height, non_null(:integer))
  end

  input_object :wallpaper_upload_prepare_input do
    @desc "Theme for the generated images."
    field(:theme, non_null(:wallpaper_theme))
    @desc "Wallpaper settings used to render the images."
    field(:settings, non_null(:wallpaper_settings_input))
    @desc "Expected current wallpaper version."
    field(:base_version, non_null(:integer))
    @desc "Identifier for retrying this preparation command."
    field(:command_id, non_null(:id))
    @desc "Images to prepare, identified by target profile."
    field(:images, non_null(list_of(non_null(:wallpaper_image_input))))
  end

  input_object :wallpaper_restore_snapshot_input do
    @desc "Retained wallpaper snapshot to restore."
    field(:snapshot_id, non_null(:id))
    @desc "Expected current wallpaper version."
    field(:base_version, non_null(:integer))
    @desc "Identifier for retrying this restore command."
    field(:command_id, non_null(:id))
  end
end
