defmodule GroupherServer.CMS.Communities.Tags.Commands.TagSupport do
  @moduledoc """
  Provides shared target loading and terminal result building for tag Commands.

      Tag Command -> TagSupport -> FrontDesk / Query -> canonical or terminal projection
  """

  alias GroupherServer.CMS
  alias CMS.{Communities.ErrorCat, FrontDesk, Marker}
  alias CMS.Communities.Tags.Query
  alias CMS.Model.{Community, CommunityTag}

  @doc false
  def tag(id), do: FrontDesk.community_tag(id)

  @doc false
  def tag_group(id), do: FrontDesk.community_tag_group(id)

  @doc false
  def community(%Community{} = community), do: {:ok, community}

  def community(ref) when is_binary(ref), do: FrontDesk.community(ref, mode: :internal)

  def community(id) do
    case FrontDesk.community(id, mode: :internal) do
      {:ok, %Community{} = community} -> {:ok, community}
      {:error, _reason} -> {:error, ErrorCat.not_exist("Community")}
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
    case Query.tag(id) do
      {:ok, %CommunityTag{id: ^id} = tag} -> {:ok, normalize_marker(tag)}
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
    Query.group(id)
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
