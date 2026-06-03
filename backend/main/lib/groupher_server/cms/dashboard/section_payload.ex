defmodule GroupherServer.CMS.Dashboard.SectionPayload do
  @moduledoc false

  import Helper.Utils, only: [strip_struct: 1]

  alias GroupherServer.CMS.Dashboard.LinkValidator
  alias GroupherServer.CMS.Model.{CommunityDashboard, Embeds}

  # List-like dsb sections are replaced as a whole on each update.
  @replace_section_fields [
    :header_links,
    :footer_links,
    :footer_oneline_links,
    :name_alias,
    :social_links,
    :media_reports
  ]

  # embeds_one sections are incrementally updated, so we validate the merged
  # final payload through the section's embed changeset before persisting.
  @embed_section_modules %{
    base_info: Embeds.Dashboard.BaseInfo,
    wallpaper: Embeds.Dashboard.Wallpaper,
    seo: Embeds.Dashboard.SEO,
    layout: Embeds.Dashboard.Layout,
    enable: Embeds.Dashboard.Enable,
    thread_emotions: Embeds.Dashboard.ThreadEmotions,
    rss: Embeds.Dashboard.RSS,
    doc_faq: Embeds.Dashboard.DocFAQ
  }
  @validated_embed_section_fields Map.keys(@embed_section_modules)

  @spec section_args(atom(), map()) :: map() | list() | nil
  def section_args(key, args) when key in @replace_section_fields do
    args
    |> Map.drop([:community, :dsb_section])
    |> Map.get(key)
  end

  def section_args(:doc_faq, args), do: Map.get(args, :doc_faq)

  def section_args(_key, args), do: Map.drop(args, [:community, :dsb_section])

  # For embeds_one sections, always prepare the merged final payload first so
  # validation and persistence operate on the same data.
  def prepare(%CommunityDashboard{} = community_dashboard, key, args)
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

  def prepare(%CommunityDashboard{}, key, args)
      when key in [:header_links, :footer_links] do
    if is_list(args) and Enum.all?(args, &LinkValidator.valid_tree?/1) do
      {:ok, args}
    else
      {:error, {:custom, "invalid dashboard links"}}
    end
  end

  def prepare(%CommunityDashboard{}, :footer_oneline_links, args) do
    if is_list(args) and LinkValidator.valid_children?(args) do
      {:ok, args}
    else
      {:error, {:custom, "invalid dashboard links"}}
    end
  end

  # Replace-style sections are already the final payload.
  def prepare(%CommunityDashboard{}, _key, args), do: {:ok, args}
end
