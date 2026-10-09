defmodule GroupherServer.CMS.Communities.Commands.TagSupport do
  @moduledoc """
  Provides shared target loading and terminal result building for tag Commands.

      Tag Command -> TagSupport -> FrontDesk / Repo -> canonical or terminal projection
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Communities.ErrorCat
  alias CMS.FrontDesk
  alias CMS.Marker
  alias CMS.Model.{Community, CommunityTag, CommunityTagGroup}

  @doc false
  def tag(id), do: FrontDesk.community_tag(id)

  @doc false
  def tag_group(id), do: FrontDesk.community_tag_group(id)

  @doc false
  def community(%Community{} = community), do: {:ok, community}

  def community(ref) when is_binary(ref), do: FrontDesk.community(ref, mode: :internal)

  def community(id) do
    case Repo.get(Community, id) do
      %Community{} = community -> {:ok, community}
      nil -> {:error, ErrorCat.not_exist("Community")}
    end
  end

  @doc false
  def tag_confirmation(%{data: %{"tag_id" => id}}), do: present_tag(id)

  def tag_confirmation(_confirmation), do: {:error, CMS.ErrorCat.command_result_unavailable()}

  @doc false
  def group_confirmation(%{data: %{"group_id" => id}}), do: present_group(id)

  def group_confirmation(_confirmation), do: {:error, CMS.ErrorCat.command_result_unavailable()}

  @doc false
  def present_tag(id) do
    case Repo.get(CommunityTag, id) do
      %CommunityTag{} = tag ->
        tag = normalize_marker(tag)
        {:ok, Repo.preload(tag, [:community, :tag_group])}

      nil ->
        {:ok, %CommunityTag{id: id}}
    end
  end

  defp normalize_marker(%CommunityTag{marker: nil} = tag), do: tag

  defp normalize_marker(%CommunityTag{marker: marker} = tag) do
    case Marker.normalize(marker) do
      {:ok, normalized} -> %{tag | marker: normalized}
      {:error, _reason} -> tag
    end
  end

  @doc false
  def present_group(id) do
    case Repo.get(CommunityTagGroup, id) do
      %CommunityTagGroup{} = group -> {:ok, Repo.preload(group, tags: [:community, :tag_group])}
      nil -> {:ok, %CommunityTagGroup{id: id}}
    end
  end

  @doc false
  def confirmation(module, key, value, command_id) do
    struct(module, data: %{key => value, "command_id" => command_id})
  end

  @doc false
  def command_id(command_id) do
    case Ecto.UUID.cast(command_id) do
      {:ok, command_id} -> {:ok, command_id}
      :error when is_nil(command_id) -> {:error, CMS.ErrorCat.command_id_required()}
      :error -> {:error, CMS.ErrorCat.command_id_invalid()}
    end
  end

  @doc false
  def intent_attrs(attrs) when is_map(attrs) do
    Map.drop(attrs, [
      :community,
      :author,
      :tag_group,
      :command_id,
      "community",
      "author",
      "tag_group",
      "command_id"
    ])
  end

  def intent_attrs(attrs), do: attrs
end
