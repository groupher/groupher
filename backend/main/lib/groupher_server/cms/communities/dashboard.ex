defmodule GroupherServer.CMS.Communities.Dashboard do
  @moduledoc """
  Dashboard helpers for communities.
  """

  alias GroupherServer.CMS

  import Helper.Utils, only: [strip_struct: 1]

  alias CMS.Model.{Community, CommunityDashboard, Embeds}
  alias Helper.{ORM, T, Transaction}

  @default_dashboard CommunityDashboard.default()
  # List-like dsb sections are replaced as a whole on each update.
  @replace_section_fields [
    :header_links,
    :footer_links,
    :footer_oneline_links,
    :name_alias,
    :social_links,
    :media_reports,
    :faqs
  ]

  # embeds_one sections are incrementally updated, so we validate the merged
  # final payload through the section's embed changeset before persisting.
  @embed_section_modules %{
    base_info: Embeds.DashboardBaseInfo,
    wallpaper: Embeds.DashboardWallpaper,
    seo: Embeds.DashboardSEO,
    layout: Embeds.DashboardLayout,
    enable: Embeds.DashboardEnable,
    thread_emotions: Embeds.DashboardThreadEmotions,
    rss: Embeds.DashboardRSS
  }
  @validated_embed_section_fields Map.keys(@embed_section_modules)

  @doc """
  update dashboard settings of a community
  """
  @spec update(Community.t(), atom(), map() | list()) :: T.domain_res(Community.t())
  def update(%Community{} = community, :base_info, args) do
    main_fields =
      Map.take(args, [:title, :locale, :desc, :logo, :favicon, :slug, :homepage])

    with {:ok, community} <- update_community_if_need(community, main_fields) do
      do_update(community, :base_info, Map.merge(args, main_fields))
    end
  end

  def update(%Community{} = community, key, args) do
    do_update(community, key, args)
  end

  defp do_update(%Community{} = community, key, args) do
    with {:ok, community_dashboard} <- ensure_exist(community),
         {:ok, section_payload} <-
           prepare_dsb_section_payload(community_dashboard, key, args),
         {:ok, _} <- apply_dsb_section_update(community_dashboard, key, section_payload) do
      {:ok, community}
    end
  end

  defp ensure_exist(%Community{} = community) do
    Transaction.lock_global("community_dashboard:init:#{community.id}", fn ->
      case ORM.find_by(CommunityDashboard, community_id: community.id) do
        {:error, _} ->
          ORM.create(
            CommunityDashboard,
            %{community_id: community.id} |> Map.merge(@default_dashboard)
          )

        {:ok, community_dashboard} ->
          {:ok, community_dashboard}
      end
    end)
  end

  # see https://elixirforum.com/t/pattern-match-on-empty-maps/33259/5
  defp update_community_if_need(%Community{} = community, fields) when map_size(fields) == 0 do
    {:ok, community}
  end

  defp update_community_if_need(%Community{} = community, fields) do
    ORM.update(community, fields)
  end

  # For embeds_one sections, always prepare the merged final payload first so
  # validation and persistence operate on the same data.
  defp prepare_dsb_section_payload(%CommunityDashboard{} = community_dashboard, key, args)
       when key in @validated_embed_section_fields do
    embed_module = Map.fetch!(@embed_section_modules, key)
    current_embed = community_dashboard[key] || struct(embed_module)
    merged_args = current_embed |> Map.merge(args) |> strip_struct()

    case embed_module.changeset(current_embed, merged_args) do
      %{valid?: true} = changeset ->
        normalized_payload =
          changeset
          |> Ecto.Changeset.apply_changes()
          |> strip_struct()

        {:ok, normalized_payload}

      changeset ->
        {:error, changeset}
    end
  end

  defp prepare_dsb_section_payload(%CommunityDashboard{}, key, args)
       when key in [:header_links, :footer_links] and is_list(args) do
    if Enum.all?(args, &valid_tree_link?/1) do
      {:ok, args}
    else
      {:error, {:custom, "invalid dashboard links"}}
    end
  end

  defp prepare_dsb_section_payload(%CommunityDashboard{}, :footer_oneline_links, args)
       when is_list(args) do
    if valid_link_children?(args) do
      {:ok, args}
    else
      {:error, {:custom, "invalid dashboard links"}}
    end
  end

  # Replace-style sections are already the final payload.
  defp prepare_dsb_section_payload(%CommunityDashboard{}, _key, args), do: {:ok, args}

  defp valid_tree_link?(%{id: id, type: type, title: title} = item)
       when is_binary(id) and is_binary(title) do
    case type do
      :link -> is_binary(Map.get(item, :url))
      :group -> valid_link_children?(Map.get(item, :links, []))
      _ -> false
    end
  end

  defp valid_tree_link?(_), do: false

  defp valid_link_children?(links) when is_list(links) do
    Enum.all?(links, fn
      %{id: id, title: title, url: url} ->
        is_binary(id) and is_binary(title) and is_binary(url)

      _ ->
        false
    end)
  end

  defp valid_link_children?(_), do: false

  # Replace-style sections are written as a whole on each update.
  defp apply_dsb_section_update(%CommunityDashboard{} = community_dashboard, key, args)
       when key in @replace_section_fields do
    ORM.replace_dsb_section(community_dashboard, key, args)
  end

  # embeds_one sections receive the validated final payload directly.
  defp apply_dsb_section_update(%CommunityDashboard{} = community_dashboard, key, args) do
    ORM.replace_dsb_section(community_dashboard, key, args)
  end
end
