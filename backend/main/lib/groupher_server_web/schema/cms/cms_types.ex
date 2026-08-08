defmodule GroupherServerWeb.Schema.CMS.Types do
  @moduledoc """
  GraphQL object and payload types for the CMS domain.

  These types define the user-facing CMS data contract used by query and
  mutation fields in Playground, including communities, articles, comments,
  dashboard settings, moderation payloads, and pagination wrappers.
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields
  import GroupherServerWeb.Schema.Helper.Objects

  import Ecto.Query, warn: false, except: [union: 2]
  import Absinthe.Resolution.Helpers, only: [dataloader: 2]

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Marker
  alias CMS.Dashboard.ThemePreset
  alias CMS.Model.{Community, CoverBackground}
  alias Helper.{ORM, PermissionRegistry}
  alias GroupherServerWeb.Schema

  import_types(Schema.CMS.Metrics)

  object :check_state do
    @desc "Whether the checked resource exists or condition is met."
    field(:exist, :boolean)
  end

  object :done_state do
    @desc "Whether the requested operation completed successfully."
    field(:done, :boolean)
  end

  object :trashed_article do
    field(:id, non_null(:id), resolve: fn item, _, _ -> {:ok, item.hash_id} end)
    field(:thread, non_null(:thread))
    field(:article_ref, non_null(:id), resolve: fn item, _, _ -> {:ok, item.article_hash_id} end)
    field(:article, :article)
    field(:deleted_by, :user, resolve: dataloader(CMS, :deleted_by))
    field(:deleted_at, non_null(:datetime))
    field(:mentioned_by_count, non_null(:integer))

    field(:scheduled_permanent_deletion_at, non_null(:datetime),
      resolve: fn item, _, _ -> {:ok, item.trash_action.scheduled_permanent_deletion_at} end
    )

    field :mentioned_by, :paged_mentions do
      arg(:filter, :pagi_filter)
      resolve(&GroupherServerWeb.Resolvers.CMS.trashed_article_mentioned_by/3)
    end

    field :mentions, :paged_mentions do
      arg(:filter, :pagi_filter)
      resolve(&GroupherServerWeb.Resolvers.CMS.trashed_article_mentions/3)
    end
  end

  object :paged_trashed_articles do
    field(:entries, non_null(list_of(non_null(:trashed_article))))
    pagination_fields()
  end

  object :audit_log do
    field(:id, non_null(:id), resolve: fn log, _, _ -> {:ok, log.hash_id} end)
    field(:actor_type, non_null(:string))
    field(:actor_snapshot, non_null(:json))
    field(:action, non_null(:string))
    field(:resource_type, non_null(:string))
    field(:resource_ref, non_null(:string))
    field(:resource_snapshot, non_null(:json))
    field(:operation_ref, :id)
    field(:source, non_null(:string))
    field(:metadata, non_null(:json))
    field(:occurred_at, non_null(:datetime))
  end

  object :paged_audit_logs do
    field(:entries, non_null(list_of(non_null(:audit_log))))
    pagination_fields()
  end

  enum :doc_tree_node_type do
    value(:tab)
    value(:group)
    value(:page)
    value(:link)
    value(:pin)
  end

  enum :article_snapshot_stage do
    value(:draft)
    value(:public)
  end

  enum :article_branch_type do
    value(:main)
    value(:preview)
  end

  enum :article_branch_status do
    value(:active)
    value(:archived)
  end

  enum :article_snapshot_action do
    value(:checkpoint)
    value(:publish)
    value(:fork)
    value(:promote)
    value(:restore)
  end

  object :article_branch do
    field(:slug, non_null(:string))
    field(:title, non_null(:string))
    field(:type, non_null(:article_branch_type))
    field(:status, non_null(:article_branch_status))
  end

  enum :doc_publish_mode do
    value(:with_cover_sync)
    value(:doc_only)
  end

  enum :doc_publish_status do
    value(:draft)
    value(:public)
  end

  enum :doc_cover_view do
    value(:public)
    value(:dashboard)
  end

  enum :community_asset_type do
    value(:image)
    value(:video)
    value(:audio)
    value(:file)
  end

  enum :community_asset_status do
    value(:active)
    value(:deleted)
  end

  enum :article_document_asset_usage do
    value(:inline)
    value(:cover)
    value(:cover_dark)
    value(:attachment)
    value(:embed)
  end

  enum :marker_type do
    value(:icon)
    value(:emoji)
  end

  object :marker_theme_appearance do
    field(:color, :string, resolve: &resolve_marker_field(:color, &1, &2, &3))
    field(:bg, :string, resolve: &resolve_marker_field(:bg, &1, &2, &3))
  end

  object :marker_appearance do
    field(
      :light,
      non_null(:marker_theme_appearance),
      resolve: &resolve_marker_field(:light, &1, &2, &3)
    )

    field(
      :dark,
      non_null(:marker_theme_appearance),
      resolve: &resolve_marker_field(:dark, &1, &2, &3)
    )
  end

  object :marker do
    field(:type, non_null(:marker_type), resolve: &resolve_marker_field(:type, &1, &2, &3))
    field(:provider, :string, resolve: &resolve_marker_field(:provider, &1, &2, &3))
    field(:name, :string, resolve: &resolve_marker_field(:name, &1, &2, &3))
    field(:src, :string, resolve: &resolve_marker_field(:src, &1, &2, &3))
    field(:unified, :string, resolve: &resolve_marker_field(:unified, &1, &2, &3))

    field(:appearance, :marker_appearance,
      resolve: &resolve_marker_field(:appearance, &1, &2, &3)
    )
  end

  input_object :marker_theme_appearance_input do
    field(:color, :string)
    field(:bg, :string)
  end

  input_object :marker_appearance_input do
    field(:light, non_null(:marker_theme_appearance_input))
    field(:dark, non_null(:marker_theme_appearance_input))
  end

  input_object :marker_input do
    field(:type, non_null(:marker_type))
    field(:provider, :string)
    field(:name, :string)
    field(:src, :string)
    field(:unified, :string)
    field(:appearance, :marker_appearance_input)
  end

  object :doc_tree_node do
    @desc """
    Stable logical node identity (`doc_tree_nodes.node_id`). The physical
    database row id is intentionally not exposed by the Tree API.
    """
    field(:id, :id)

    @desc """
    Immediate parent logical node id in the same Community, Branch, and Stage.
    This references another row's `node_id`, which is exposed as GraphQL `id`;
    it never references the physical database row id. Null only for root Tabs.
    """
    field(:parent_node_id, :id)

    field(:doc_id, :id)
    field(:type, :doc_tree_node_type)
    field(:title, :string)
    field(:index, :integer)
    field(:href, :string)
    field(:marker, :marker)
    field(:badge, :string)
    field(:hidden, :boolean)
    field(:publish_state, :doc_tree_node_publish_state)
    field(:groups, list_of(:doc_tree_node))
    field(:pages, list_of(:doc_tree_node))
    field(:pins, list_of(:doc_tree_node))
  end

  object :doc_tree_node_publish_state do
    field(:status, :doc_publish_status)
    field(:published, :boolean)
    field(:published_before, :boolean)
    field(:has_draft, :boolean)
    field(:public_node_id, :id)
    field(:public_doc_id, :id)
    field(:has_unpublished_changes, :boolean)
    field(:last_published_at, :datetime)
    field(:in_cover, :boolean)
    field(:hidden_from_cover, :boolean)
    field(:pinned_to_cover, :boolean)
  end

  object :doc_tree_state do
    field(:has_unpublished_changes, :boolean)
    field(:staged_event_count, :integer)
    field(:base_snapshot_id, :id)
    field(:latest_snapshot_id, :id)
    field(:latest_release_id, :id)
    field(:latest_release_number, :integer)
    field(:latest_version_slug, :string)
    field(:revision, :integer)
  end

  object :doc_tree_event do
    field(:id, :id)
    field(:seq, :integer)
    field(:event_type, :string)
    field(:payload, :json)
    field(:inverse_payload, :json)
    field(:status, :string)
    field(:owner, :string)
    field(:doc_id, :id)
    field(:inserted_at, :datetime)
  end

  object :doc_tree do
    field(:revision, :integer)
    field(:tree_state, :doc_tree_state)
    field(:staged_events, list_of(:doc_tree_event))
    field(:tabs, list_of(:doc_tree_node))
  end

  object :doc_public_tree_node do
    @desc "Stable logical `node_id`; the physical database row id is not exposed."
    field(:id, :id)

    @desc "Direct parent's logical `node_id`; null only for root Tabs."
    field(:parent_node_id, :id)
    field(:doc_id, :id)
    field(:type, :doc_tree_node_type)
    field(:title, :string)
    field(:index, :integer)
    field(:href, :string)
    field(:marker, :marker)
    field(:badge, :string)
    field(:groups, list_of(:doc_public_tree_node))
    field(:pages, list_of(:doc_public_tree_node))
    field(:pins, list_of(:doc_public_tree_node))
  end

  object :doc_public_tree do
    field(:tabs, list_of(:doc_public_tree_node))
  end

  object :doc_publish_checklist_item do
    field(:id, non_null(:id))
    field(:title, non_null(:string))
    field(:action, non_null(:string))
    field(:selected_by_default, non_null(:boolean))
    field(:selectable, non_null(:boolean))
    field(:disabled_reason, :string)
  end

  object :doc_publish_checklist do
    field(:total_count, non_null(:integer))
    field(:doc_changes, non_null(list_of(non_null(:doc_publish_checklist_item))))
    field(:tree_changes, non_null(list_of(non_null(:doc_publish_checklist_item))))
  end

  object :doc_publish_scope do
    field(:total_count, non_null(:integer))
  end

  object :doc_publish_release do
    field(:id, non_null(:id))
    field(:release_number, non_null(:integer))
    field(:version_slug, non_null(:string))
    field(:published_at, non_null(:datetime))
  end

  object :doc_tree_trash_item do
    field(:id, non_null(:id))
    field(:node_id, non_null(:id))
    field(:doc_id, :id)
    field(:type, :string)
    field(:title, :string)
    field(:deleted_from_parent_node_id, :id)
    field(:deleted_from_index, :integer)
    field(:deleted_at, :datetime)
    field(:restored_at, :datetime)
  end

  object :doc_publish_changes_payload do
    field(:done, non_null(:boolean))
    field(:release, :doc_publish_release)
    field(:checklist, non_null(:doc_publish_checklist))
    field(:scope, non_null(:doc_publish_scope))
  end

  input_object :doc_publish_changes_input do
    field(:doc_change_ids, list_of(:id))
    field(:tree_change_ids, list_of(:id))
    field(:restore_tree_change_ids, list_of(:id))
  end

  object :doc_cover do
    field(:cards, non_null(list_of(non_null(:doc_cover_card))))
    field(:pinned_docs, non_null(list_of(non_null(:doc_cover_pinned_doc))))
  end

  object :doc_cover_card do
    field(:id, non_null(:id))
    field(:group_node_id, non_null(:id))
    field(:index, non_null(:integer))
    field(:appearance, non_null(:json))
    field(:title, non_null(:string))
    field(:items, non_null(list_of(non_null(:doc_cover_card_item))))
  end

  object :doc_cover_card_item do
    field(:id, non_null(:id))
    field(:node_id, non_null(:id))
    field(:index, non_null(:integer))
    field(:doc_id, :id)
    field(:type, non_null(:doc_tree_node_type))
    field(:title, non_null(:string))
    field(:href, non_null(:string))
    field(:marker, :marker)
    field(:badge, :string)
    field(:leaf_count, :integer)
  end

  object :doc_cover_pinned_doc do
    field(:node_id, non_null(:id))
    field(:index, non_null(:integer))
    field(:appearance, non_null(:json))
    field(:href, non_null(:string))
    field(:doc, non_null(:doc))
  end

  object :doc_draft do
    field(:id, :id)
    field(:doc_id, :id, resolve: fn draft, _, _ -> {:ok, draft.article_hash_id} end)
    field(:title, :string)
    field(:subtitle, :string)
    field(:slug, :string)
    field(:stage, :article_snapshot_stage)
    field(:digest, :string)
    field(:author, :user, resolve: dataloader(CMS, :author))
    timestamp_fields()
    field(:document, :article_document, resolve: fn draft, _, _ -> {:ok, draft} end)
  end

  object :article_draft do
    field(:id, non_null(:id), resolve: fn draft, _, _ -> {:ok, draft.article_hash_id} end)
    field(:thread, non_null(:thread), resolve: fn draft, _, _ -> {:ok, draft.meta.thread} end)
    field(:stage, non_null(:article_snapshot_stage))
    field(:title, non_null(:string))
    field(:digest, :string)
    field(:slug, :string)
    field(:subtitle, :string)
    field(:document, :article_document, resolve: fn draft, _, _ -> {:ok, draft} end)
    timestamp_fields()
  end

  object :doc_tree_mutation_payload do
    field(:revision, :integer)
    field(:tree_state, :doc_tree_state)
    field(:node, :doc_tree_node)
    field(:affected_nodes, list_of(:doc_tree_node))
    field(:conflict, :boolean)
  end

  object :move_doc_to_draft_payload do
    field(:doc_id, :id)
    field(:stage, :article_snapshot_stage)
    field(:publish_state, :doc_tree_node_publish_state)
  end

  input_object :doc_tree_node_input do
    field(:type, non_null(:doc_tree_node_type))
    field(:title, non_null(:string))
    field(:doc_id, :id)
    field(:index, :integer)
    field(:href, :string)
    field(:marker, :marker_input)
    field(:badge, :string)
    field(:hidden, :boolean)
  end

  input_object :doc_tree_node_patch_input do
    field(:title, :string)
    field(:href, :string)
    field(:marker, :marker_input)
    field(:badge, :string)
    field(:hidden, :boolean)
  end

  object :dsb_theme_preset_option do
    field(:value, non_null(:dsb_theme_preset))
    field(:tokens, non_null(:json))
  end

  ######
  # common stands for minimal info of the type
  # usually used in abuse_report, feeds, etc ..
  object :common_user do
    field(:login, :string)
    field(:avatar, :string)
    field(:nickname, :string)
    field(:bio, :string)
    field(:shortbio, :string)
  end

  object :common_article do
    field(:thread, :thread)
    field(:inner_id, :id)
    # field(:body_html, :string)
    field(:title, :string)
    field(:author, :common_user)
  end

  object :common_comment do
    field(:inner_id, :id, resolve: &R.CMS.comment_inner_id/3)
    field(:body_html, :string)
    field(:upvotes_count, :integer)
    field(:author, :common_user)
    field(:article, :common_article)
  end

  ######

  object :idlike do
    field(:id, :id)
  end

  object :community_asset do
    field(:id, :id)
    field(:public_ref, :string)
    field(:thread, :thread)
    field(:asset_type, :community_asset_type)
    field(:status, :community_asset_status)
    field(:title, :string)
    field(:filename, :string)
    field(:mime_type, :string)
    field(:url, :string)
    field(:storage, :string)
    field(:storage_key, :string)
    field(:content_hash, :string)
    field(:size_bytes, :big_int)
    field(:width, :integer)
    field(:height, :integer)
    field(:meta, :json)
    field(:deleted_at, :datetime)
    field(:community, :community, resolve: dataloader(CMS, :community))
    field(:uploader, :user, resolve: dataloader(CMS, :uploader))

    timestamp_fields()
  end

  object :article_document_asset_ref do
    field(:id, :id)
    field(:thread, :thread)
    field(:article_id, :id)
    field(:usage, :article_document_asset_usage)
    field(:block_id, :string)
    field(:block_type, :string)
    field(:position, :integer)
    field(:title, :string)
    field(:alt, :string)
    field(:source, :string)
    field(:meta, :json)
    field(:asset, :community_asset, resolve: dataloader(CMS, :asset))

    timestamp_fields()
  end

  object :community_asset_usage do
    field(:asset_count, :integer)
    field(:storage_bytes, :big_int)
  end

  object :community_asset_thread_stat do
    field(:thread, non_null(:thread))
    field(:count, non_null(:integer))
  end

  object :community_asset_subtype_stat do
    field(:key, non_null(:string))
    field(:label, non_null(:string))
    field(:count, non_null(:integer))
  end

  object :community_asset_type_stat do
    field(:asset_type, non_null(:community_asset_type))
    field(:count, non_null(:integer))
    field(:subtypes, non_null(list_of(non_null(:community_asset_subtype_stat))))
  end

  object :community_asset_stats do
    field(:total_count, non_null(:integer))
    field(:storage_bytes, non_null(:big_int))
    field(:storage_limit_bytes, non_null(:big_int))
    field(:by_thread, non_null(list_of(non_null(:community_asset_thread_stat))))
    field(:by_asset_type, non_null(list_of(non_null(:community_asset_type_stat))))
  end

  object :community_asset_origin_info do
    field(:public_ref, non_null(:string))
    field(:status, non_null(:community_asset_status))
    field(:deleted_at, :datetime)
    field(:filename, :string)
    field(:storage, :string)
    field(:storage_key, :string)
    field(:mime_type, :string)
    field(:size_bytes, :big_int)
    field(:width, :integer)
    field(:height, :integer)
    field(:meta, :json)
  end

  input_object :community_asset_input do
    field(:thread, :thread)
    field(:asset_type, :community_asset_type)
    field(:title, :string)
    field(:filename, :string)
    field(:mime_type, :string)
    field(:url, non_null(:string))
    field(:storage, :string)
    field(:storage_key, :string)
    field(:content_hash, :string)
    field(:size_bytes, non_null(:big_int))
    field(:width, :integer)
    field(:height, :integer)
    field(:meta, :json)
  end

  object :community_asset_upload_intent do
    field(:upload_ref, non_null(:string))
    field(:asset_public_ref, non_null(:string))
    field(:object_key, non_null(:string))
    field(:capability, non_null(:string))
    field(:expires_at, non_null(:datetime))
    field(:max_size_bytes, non_null(:big_int))
    field(:allowed_mime_types, non_null(list_of(non_null(:string))))
  end

  input_object :community_asset_upload_file_input do
    field(:filename, non_null(:string))
    field(:mime_type, non_null(:string))
    field(:size_bytes, non_null(:big_int))
    field(:checksum_sha256, :string)
    field(:thread, :thread)
    field(:asset_type, :community_asset_type)
  end

  input_object :community_asset_filter do
    field(:page, :integer)
    field(:size, :integer)
    field(:query, :string)
    field(:thread, :thread)
    field(:asset_type, :community_asset_type)
    field(:subtypes, list_of(non_null(:string)))
  end

  input_object :community_asset_upload_completion_input do
    field(:idempotency_key, non_null(:string))
    field(:community_id, non_null(:id))
    field(:uploader_id, :id)
    field(:asset_public_ref, non_null(:string))
    field(:url, non_null(:string))
    field(:storage, non_null(:string))
    field(:storage_key, non_null(:string))
    field(:content_hash, non_null(:string))
    field(:size_bytes, non_null(:big_int))
    field(:filename, :string)
    field(:mime_type, :string)
    field(:thread, :thread)
    field(:asset_type, :community_asset_type)
    field(:width, :integer)
    field(:height, :integer)
    field(:meta, :json)
  end

  input_object :article_document_asset_ref_input do
    field(:asset_id, :id)
    field(:asset, :community_asset_input)
    field(:usage, :article_document_asset_usage)
    field(:block_id, :string)
    field(:block_type, :string)
    field(:position, :integer)
    field(:title, :string)
    field(:alt, :string)
    field(:source, :string)
    field(:meta, :json)
  end

  input_object :artiment_toc_item_input do
    field(:id, non_null(:string))
    field(:level, non_null(:integer))
    field(:title, non_null(:string))
  end

  input_object :artiment_body_bag_input do
    field(:json, non_null(:string))
    field(:markdown, non_null(:string))
    field(:html, non_null(:string))
    field(:toc, non_null(list_of(non_null(:artiment_toc_item_input))))
    field(:plain_text, non_null(:string))
    field(:digest, non_null(:string))
    field(:body_hash, non_null(:string))
    field(:schema_version, non_null(:integer))
  end

  object :article_document do
    field(:json, :string)
    field(:markdown, :string)
    field(:markdown_toc, :json)
    field(:thumbnail, :json)
    field(:html, :string)
    field(:plain_text, :string)
    field(:digest, :string)
    field(:body_hash, :string)
    field(:schema_version, :integer)

    field(:asset_refs, list_of(:article_document_asset_ref),
      resolve: dataloader(CMS, :asset_refs)
    )
  end

  object :article_snapshot do
    field(:id, :id, resolve: fn snapshot, _, _ -> {:ok, snapshot.hash_id} end)
    field(:thread, :thread)
    field(:stage, :article_snapshot_stage)
    field(:action, :article_snapshot_action)
    field(:article_hash_id, :string)
    field(:title, :string)
    field(:slug, :string)
    field(:subtitle, :string)
    field(:digest, :string)
    field(:document_json, :string)
    field(:version_hash, :string)
    field(:revision_number, :integer)
    field(:schema_version, :integer)
    field(:data, :json)
    field(:message, :string)
    field(:author, :user, resolve: dataloader(CMS, :author))
    timestamp_fields()
  end

  object :post do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    field(:cat, :article_cat_enum)
    field(:status, :article_status_enum)

    timestamp_fields(:article)
  end

  object :changelog do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    timestamp_fields(:article)
  end

  object :doc do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    field(:subtitle, :string)
    comments_fields()

    timestamp_fields(:article)
  end

  object :blog do
    meta(:cache, max_age: 30)
    interface(:article)

    general_article_fields()
    comments_fields()

    timestamp_fields(:article)
  end

  object :contribute do
    meta(:cache, max_age: 30)
    field(:date, :date)
    field(:count, :integer)
  end

  object :contribute_map do
    meta(:cache, max_age: 30)
    field(:start_date, :date)
    field(:end_date, :date)
    field(:total_count, :integer)
    field(:records, list_of(:contribute))
  end

  object(:dsb_rss, do: dsb_gq_fields(:rss))
  object(:dsb_seo, do: dsb_gq_fields(:seo))
  object(:dsb_bg_config, do: dsb_gq_fields(:wallpaper_bg))

  object :cover_background do
    field(:id, :id)
    dsb_gq_fields(:wallpaper_bg)
  end

  object :cover_config do
    field(:background_id, :id)
    field(:original_background_id, :id)

    field :background, :cover_background do
      resolve(dataloader(CMS, &cover_background_loader(:background_id, &1, &2, &3)))
    end

    field :original_background, :cover_background do
      resolve(dataloader(CMS, &cover_background_loader(:original_background_id, &1, &2, &3)))
    end

    field(:images, list_of(:json))
  end

  object :cover_edit_info do
    field(:id, :id)
    field(:canvas_width, :integer)
    field(:canvas_height, :integer)
    field(:version, :integer)
    field(:light, :cover_config)
    field(:dark, :cover_config)

    timestamp_fields()
  end

  input_object :cover_background_input do
    dsb_input_fields(:wallpaper_bg)
  end

  input_object :cover_config_input do
    field(:background_id, :id)
    field(:background, :cover_background_input)
    field(:original_background_id, :id)
    field(:original_background, :cover_background_input)
    field(:images, list_of(:json))
  end

  input_object :cover_edit_info_input do
    field(:canvas_width, non_null(:integer))
    field(:canvas_height, non_null(:integer))
    field(:version, :integer)
    field(:light, non_null(:cover_config_input))
    field(:dark, non_null(:cover_config_input))
  end

  object :dsb_wallpaper do
    field(:light, :dsb_bg_config)
    field(:dark, :dsb_bg_config)
  end

  object :dsb_layout do
    dsb_gq_fields(:layout, except: [:custom_theme_preset])

    @desc "Base preset used by the current custom theme preset."
    field :theme_preset_base, :dsb_theme_preset do
      resolve(fn layout, _, _ ->
        # `themePresetBase` describes the saved Custom preset only. Returning
        # nil when Custom has not been created lets clients distinguish that
        # state from "Custom exists and is based on DEFAULT".
        if is_map(layout.custom_theme_preset) do
          {:ok, ThemePreset.custom_base_preset(layout.custom_theme_preset)}
        else
          {:ok, nil}
        end
      end)
    end

    @desc "Resolved design tokens for the active theme preset."
    field :theme_tokens, :json do
      resolve(fn layout, _, _ ->
        tokens =
          ThemePreset.resolve(
            layout.theme_preset,
            layout.custom_theme_preset
          )

        {:ok, tokens}
      end)
    end

    @desc "Theme preset options available for dashboard layout settings."
    field :theme_presets, list_of(:dsb_theme_preset_option) do
      resolve(fn layout, _, _ ->
        {:ok, ThemePreset.options(layout.custom_theme_preset)}
      end)
    end
  end

  object(:dsb_enable, do: dsb_gq_fields(:enable))

  object :dsb_thread_emotions do
    field(:post, list_of(:emotion_type))
    field(:blog, list_of(:emotion_type))
    field(:changelog, list_of(:emotion_type))
    field(:doc, list_of(:emotion_type))
    field(:post_comment, list_of(:emotion_type))
    field(:blog_comment, list_of(:emotion_type))
    field(:changelog_comment, list_of(:emotion_type))
    field(:doc_comment, list_of(:emotion_type))
  end

  object(:dsb_base_info, do: dsb_gq_fields(:base_info))
  object(:dsb_name_alias, do: dsb_gq_fields(:name_alias))

  object :dsb_link_child do
    field(:id, :string)
    field(:title, :string)
    field(:url, :string)
  end

  object :dsb_link do
    field(:id, :string)
    field(:type, :dsb_link_type)
    field(:title, :string)
    field(:url, :string)
    field(:links, list_of(:dsb_link_child))
  end

  object(:dsb_social_link, do: dsb_gq_fields(:social_link))
  object(:dsb_media_report, do: dsb_gq_fields(:media_report))

  object :dsb_third_party_analytics_provider_field do
    field(:key, :string)
    field(:label, :string)
    field(:desc, :string)
    field(:placeholder, :string)
    field(:required_when_enabled, :boolean)
    field(:pattern, :string)
  end

  object :dsb_third_party_analytics_provider do
    field(:provider, :string)
    field(:title, :string)
    field(:desc, :string)
    field(:detail, :string)
    field(:docs_url, :string)
    field(:icon, :string)
    field(:identity_field, :string)
    field(:config_fields, list_of(:dsb_third_party_analytics_provider_field))
  end

  object :dsb_third_party_analytics do
    field(:provider, :string)
    field(:enabled, :boolean)
    field(:measurement_id, :string)
    field(:container_id, :string)
    field(:project_id, :string)
    field(:domain, :string)
    field(:site_id, :string)
  end

  input_object :dsb_third_party_analytics_input do
    field(:provider, :string)
    field(:enabled, :boolean)
    field(:measurement_id, :string)
    field(:container_id, :string)
    field(:project_id, :string)
    field(:domain, :string)
    field(:site_id, :string)
  end

  object :dsb_doc_faq_item do
    field(:id, :id)
    field(:title, :string)
    field(:detail, :string)
    field(:index, :integer)
  end

  object :dsb_doc_faq_group do
    field(:id, :id)
    field(:title, :string)
    field(:index, :integer)
    field(:items, list_of(:dsb_doc_faq_item))
  end

  object :dsb_doc_faq do
    field(:title, :string)
    field(:desc, :string)
    field(:grouped_view, :boolean)
    field(:group_items, list_of(:dsb_doc_faq_group))
    field(:flat_items, list_of(:dsb_doc_faq_item))
  end

  input_object :dsb_doc_faq_item_input do
    field(:id, :string)
    field(:title, :string)
    field(:detail, :string)
    field(:index, :integer)
  end

  input_object :dsb_doc_faq_group_input do
    field(:id, :string)
    field(:title, :string)
    field(:index, :integer)
    field(:items, list_of(:dsb_doc_faq_item_input))
  end

  input_object :dsb_doc_faq_input do
    field(:title, :string)
    field(:desc, :string)
    field(:grouped_view, :boolean)
    field(:group_items, list_of(:dsb_doc_faq_group_input))
    field(:flat_items, list_of(:dsb_doc_faq_item_input))
  end

  object :dsb do
    field(:seo, :dsb_seo)
    field(:wallpaper, :dsb_wallpaper)
    field(:layout, :dsb_layout)
    field(:enable, :dsb_enable)
    field(:thread_emotions, :dsb_thread_emotions)
    field(:base_info, :dsb_base_info)
    field(:rss, :dsb_rss)
    field(:name_alias, list_of(:dsb_name_alias))
    field(:header_links, list_of(:dsb_link))
    field(:footer_links, list_of(:dsb_link))
    field(:footer_oneline_links, list_of(:dsb_link_child))
    field(:social_links, list_of(:dsb_social_link))
    field(:media_reports, list_of(:dsb_media_report))
    field(:doc_faq, :dsb_doc_faq)
    field(:third_party_analytics, list_of(:dsb_third_party_analytics))
    field(:umami_website_id, :string)

    field :enabled_third_party_analytics, list_of(:dsb_third_party_analytics) do
      resolve(fn dashboard, _, _ ->
        {:ok,
         GroupherServer.CMS.Dashboard.ThirdPartyAnalytics.enabled_valid_configs(
           dashboard.third_party_analytics
         )}
      end)
    end
  end

  object :community_moderator do
    field(:is_root, :boolean) do
      resolve(fn moderator, _, _ ->
        with {:ok, {passport, community_slug}} <- moderator_passport_context(moderator) do
          {:ok, moderator_root?(passport, community_slug)}
        else
          _ -> {:ok, false}
        end
      end)
    end

    field(:passport_item_count, :integer) do
      resolve(fn moderator, _, _ ->
        with {:ok, {passport, community_slug}} <- moderator_passport_context(moderator) do
          {:ok, moderator_passport_item_count(passport, community_slug)}
        else
          _ -> {:ok, fallback_moderator_passport_item_count(moderator)}
        end
      end)
    end

    field(:user, :common_user)
  end

  object :all_rules do
    field(:root, :string)
    field(:moderator, :string)
  end

  object :community do
    meta(:cache, max_age: 30)
    @desc "Community display title."
    field(:title, :string)
    @desc "Community introduction text."
    field(:desc, :string)
    @desc "Community slug used in API routes."
    field(:slug, :string)
    field(:favicon, :string)
    field(:homepage, :string)
    field(:index, :integer)
    field(:logo, :string)
    @desc "Community owner account."
    field(:author, :user, resolve: dataloader(CMS, :author))
    field(:locale, :string)
    field(:categories, list_of(:category), resolve: dataloader(CMS, :categories))
    @desc "Dashboard configuration for this community."
    field(:dashboard, :dsb, resolve: dataloader(CMS, :dashboard))

    # field(:moderators, list_of(:community_moderator), resolve: dataloader(CMS, moderators: :user))
    @desc "Current moderators in the community."
    field(:moderators, list_of(:community_moderator))

    field(:meta, :community_meta)
    field(:views, :integer)
    field(:contributes_digest, list_of(:integer))

    field(:articles_count, :integer)
    field(:subscribers_count, :integer)
    field(:moderators_count, :integer)

    @desc "Total number of tags configured for the community."
    field :community_tags_count, :integer do
      resolve(&R.CMS.community_tags_count/3)
    end

    @desc "Whether the current viewer has subscribed to this community."
    field(:viewer_has_subscribed, :boolean)
    @desc "Whether the current viewer is a moderator of this community."
    field(:viewer_is_moderator, :boolean)

    field(:pending, :integer)

    timestamp_fields()
  end

  object :category do
    field(:id, :id)
    field(:title, :string)
    field(:slug, :string)
    field(:index, :integer)
    field(:author, :user, resolve: dataloader(CMS, :author))
    field(:communities, list_of(:community), resolve: dataloader(CMS, :communities))

    timestamp_fields()
  end

  object :community_tag do
    field(:id, :id)
    field(:title, :string)
    field(:desc, :string)
    field(:layout, :string)
    field(:slug, :string)
    field(:color, :rainbow_color)
    field(:thread, :thread)
    field(:group, :string, resolve: &R.CMS.community_tag_group_title/3)
    field(:group_id, :id)
    field(:extra, list_of(:string))
    field(:marker, :marker)
    field(:index, :integer)

    field(:author, :user, resolve: dataloader(CMS, :author))
    field(:community, :community, resolve: dataloader(CMS, :community))
    field(:stats, :community_tag_stat, resolve: &R.CMS.community_tag_stats/3)

    timestamp_fields()
  end

  object :community_tag_group do
    field(:id, :id)
    field(:title, :string)
    field(:thread, :thread)
    field(:index, :integer)
    field(:tags, list_of(:community_tag), resolve: dataloader(CMS, :tags))

    field(:community, :community, resolve: dataloader(CMS, :community))

    timestamp_fields()
  end

  defp resolve_marker_field(field, marker, _args, _info) do
    {:ok, Marker.field(marker, field)}
  end

  object :community_tag_stat do
    field(:contents_count, :integer)
    field(:today_contents_count, :integer)
  end

  object :emotion_stat do
    field(:type, :emotion_type)
    field(:count, :integer)
    field(:viewer_has_reacted, :boolean)
    field(:latest_users, list_of(:common_user))
  end

  object :comment_meta do
    field(:is_article_author_upvoted, :boolean)
    field(:is_reply_to_others, :boolean)

    # audit states
    field(:is_legal, :boolean)
    field(:illegal_reason, list_of(:string))
    field(:illegal_words, list_of(:string))
    field(:reported_count, :integer)
    # field(:is_solution, :boolean)
  end

  object :comment_reply do
    comment_general_fields()
  end

  object :comment do
    comment_general_fields()

    field(:replies, list_of(:comment_reply))
    field(:article, :common_article)

    field(:is_for_question, :boolean)
    field(:is_solution, :boolean)
  end

  object :comments_list_state do
    field(:total_count, :integer)
    field(:participants_count, :integer)
    field(:participants, list_of(:common_user))
    field(:is_viewer_joined, :boolean)
  end

  ####### reports
  object :abuse_report_case do
    field(:reason, :string)
    field(:attr, :string)
    field(:user, :common_user)
  end

  object :abuse_report do
    field(:id, :id)
    field(:article, :common_article)
    field(:comment, :common_comment)
    field(:account, :common_user)
    field(:report_cases_count, :integer)
    field(:deal_with, :string)
    field(:operate_user, :user)
    field(:report_cases, list_of(:abuse_report_case))

    timestamp_fields()
  end

  object :artiment_mention do
    field(:id, :id)
    field(:mentioner_type, :mention_type)
    field(:mentioner_id, :id)
    field(:mentioner_community_id, :id)
    field(:mentioner_url, :string)

    field(:mentioned_scope, :mention_scope)
    field(:mentioned_type, :mention_type)
    field(:mentioned_id, :id)
    field(:mentioned_community_id, :id)
    field(:mentioned_url, :string)
    field(:mentioned_url_hash, :string)

    field(:mention_case, :mention_case)
    field(:occurrences, list_of(:json))
    field(:mentioner_snapshot, :json)
    field(:mentioned_snapshot, :json)
    field(:meta, :json)
    field(:mentioned_at, :datetime)

    timestamp_fields()
  end

  object :blog_feed do
    field(:title, :string)
    field(:digest, :string)
    field(:link_addr, :string)
    field(:content, :string)
    field(:published, :string)
    field(:updated, :string)
  end

  object :blog_author do
    field(:name, :string)
    field(:intro, :string)
    field(:github, :string)
    field(:twitter, :string)
  end

  paged_article_objects()

  object :kanban_posts do
    field(:backlog, :paged_posts)
    field(:todo, :paged_posts)
    field(:wip, :paged_posts)
    field(:done, :paged_posts)
    field(:rejected, :paged_posts)
  end

  object :paged_reports do
    field(:entries, list_of(:abuse_report))
    pagination_fields()
  end

  object :paged_mentions do
    field(:entries, list_of(:artiment_mention))
    pagination_fields()
  end

  object :paged_community_assets do
    field(:entries, list_of(:community_asset))
    pagination_fields()
  end

  object :paged_article_document_asset_refs do
    field(:entries, list_of(:article_document_asset_ref))
    pagination_fields()
  end

  object :paged_categories do
    field(:entries, list_of(:category))
    pagination_fields()
  end

  object :paged_comments do
    field(:entries, list_of(:comment))
    pagination_fields()
  end

  object :paged_comment_replies do
    field(:entries, list_of(:comment_reply))
    pagination_fields()
  end

  object :paged_communities do
    field(:entries, list_of(:community))
    pagination_fields()
  end

  object :paged_articles do
    field(:entries, list_of(:common_article))
    pagination_fields()
  end

  object :search_article_locator do
    field(:community, non_null(:string))
    field(:thread, non_null(:thread))
    field(:inner_id, non_null(:id))
  end

  object :search_comment_locator do
    field(:article, non_null(:search_article_locator))
    field(:inner_id, non_null(:id))
    field(:root_inner_id, :id)
  end

  object :article_search_artiment do
    field(:ref, non_null(:id))
    field(:type, non_null(:search_artiment_type))
    field(:community_ref, non_null(:string))
    field(:thread, non_null(:thread))
    field(:article_ref, non_null(:id))
    field(:title, non_null(:string))
    field(:digest, :string)
    field(:locator, non_null(:search_article_locator))
    field(:author_ref, :string)
    field(:locale, :string)
    field(:upvotes_count, non_null(:integer))
    field(:comments_count, non_null(:integer))
    field(:published_at, :datetime)
    field(:inserted_at, non_null(:datetime))
    field(:updated_at, non_null(:datetime))
    field(:content_hash, non_null(:string))
    field(:schema_version, non_null(:integer))
  end

  object :comment_search_artiment do
    field(:ref, non_null(:id))
    field(:type, non_null(:search_artiment_type))
    field(:community_ref, non_null(:string))
    field(:thread, non_null(:thread))
    field(:article_ref, non_null(:id))
    field(:digest, :string)
    field(:locator, non_null(:search_comment_locator))
    field(:author_ref, :string)
    field(:locale, :string)
    field(:upvotes_count, non_null(:integer))
    field(:replies_count, non_null(:integer))
    field(:inserted_at, non_null(:datetime))
    field(:updated_at, non_null(:datetime))
    field(:content_hash, non_null(:string))
    field(:schema_version, non_null(:integer))
  end

  union :search_artiment do
    types([:article_search_artiment, :comment_search_artiment])

    resolve_type(fn
      %{type: :article}, _ -> :article_search_artiment
      %{type: :comment}, _ -> :comment_search_artiment
    end)
  end

  enum :search_highlight_field do
    value(:title)
    value(:plain_text)
  end

  object :search_highlight do
    field(:field, non_null(:search_highlight_field))
    field(:fragments, non_null(list_of(non_null(:string))))
  end

  object :search_artiment_hit do
    field(:artiment, non_null(:search_artiment))
    field(:highlights, non_null(list_of(non_null(:search_highlight))))
  end

  object :paged_search_artiments do
    field(:entries, non_null(list_of(non_null(:search_artiment_hit))))
    pagination_fields()
  end

  @desc "article meta info"
  object :article_meta do
    field(:thread, :thread)
    field(:is_edited, :boolean)
    field(:is_comment_locked, :boolean)
    field(:last_active_at, :datetime)
    field(:latest_upvoted_users, list_of(:common_user))
    # audit states
    field(:is_legal, :boolean)
    field(:illegal_reason, list_of(:string))
    field(:illegal_words, list_of(:string))
  end

  object :community_meta do
    threads_count_fields()
    field(:apply_msg, :string)
    field(:apply_category, :string)
  end

  object :open_graph do
    field(:title, :string)
    field(:url, :string)
    field(:favicon, :string)
    field(:site_name, :string)
  end

  object :client_locale do
    field(:locale, :string)
  end

  defp cover_background_loader(field, config, args, _resolution) do
    # CoverConfig is an embedded schema, so there is no Ecto association for
    # Absinthe to preload. Use the stored background id as the Dataloader item
    # key so light/dark cover backgrounds still batch through the CMS loader.
    %{batch: {CoverBackground, args}, item: Map.get(config, field)}
  end

  defp moderator_passport_context(moderator) do
    with {:ok, community_slug} <- moderator_community_slug(moderator),
         {:ok, user_id} <- moderator_user_id(moderator),
         {:ok, passport} <- CMS.Communities.get_passport(%Accounts.Model.User{id: user_id}) do
      {:ok, {passport, community_slug}}
    end
  end

  defp moderator_community_slug(%{community: %Community{slug: slug}}) when is_binary(slug),
    do: {:ok, slug}

  defp moderator_community_slug(%{community_id: community_id}) when not is_nil(community_id) do
    with {:ok, community} <- ORM.find(Community, community_id) do
      {:ok, community.slug}
    end
  end

  defp moderator_community_slug(_), do: {:error, :community_not_found}

  defp moderator_user_id(%{user_id: user_id}) when not is_nil(user_id), do: {:ok, user_id}

  defp moderator_user_id(%{user: %Accounts.Model.User{id: user_id}}) when not is_nil(user_id),
    do: {:ok, user_id}

  defp moderator_user_id(_), do: {:error, :user_not_found}

  defp moderator_root?(passport, community_slug) do
    get_in(passport, [community_slug, "root"]) == true
  end

  defp moderator_passport_item_count(passport, community_slug) do
    if moderator_root?(passport, community_slug) do
      PermissionRegistry.root_passport_item_count()
    else
      passport
      |> get_in([community_slug, "cms"])
      |> count_enabled_rules()
    end
  end

  defp fallback_moderator_passport_item_count(moderator) do
    count = moderator.passport_item_count || 0

    if count >= PermissionRegistry.root_passport_item_count(), do: 0, else: count
  end

  defp count_enabled_rules(rules) when is_map(rules) do
    Enum.count(rules, fn {_rule, enabled} -> enabled == true end)
  end

  defp count_enabled_rules(_), do: 0
end
