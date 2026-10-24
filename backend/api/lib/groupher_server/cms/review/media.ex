defmodule GroupherServer.CMS.Review.Media do
  @moduledoc """
  Resolves canonical image identities and signs short-lived provider read URLs.

      committed content refs
        -> active CommunityAsset + immutable version check
        -> 120-second Assets Hub capability
        -> provider image input (URL is never persisted)
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleAssetRef, CommunityAsset}

  @max_image_bytes 10 * 1024 * 1024
  @read_ttl_seconds 120
  @mime_types ~w(image/avif image/gif image/jpeg image/png image/webp)

  @doc """
  Extracts active, community-owned Assets Hub image identities in a Comment body snapshot.

  ## Examples

      comment_images(body.json, community.id)
      #=> [%{asset_id: 41, immutable_version: "sha256:..."}]
  """
  @spec comment_images(String.t() | nil, pos_integer()) :: [map()]
  def comment_images(body_json, community_id)
      when is_binary(body_json) and is_integer(community_id) do
    refs =
      Regex.scan(~r{/a/(asset_[A-Za-z0-9_-]+)/original}, body_json, capture: :all_but_first)
      |> List.flatten()
      |> Enum.uniq()

    if refs == [] do
      []
    else
      assets =
        from(asset in CommunityAsset,
          where:
            asset.community_id == ^community_id and asset.public_ref in ^refs and
              asset.status == :active and asset.asset_type == :image
        )
        |> Repo.all()
        |> Map.new(&{&1.public_ref, &1})

      Enum.flat_map(refs, fn ref ->
        case Map.get(assets, ref) do
          %CommunityAsset{} = asset -> [image_identity(asset)]
          nil -> []
        end
      end)
    end
  rescue
    _ -> []
  end

  def comment_images(_body_json, _community_id), do: []

  @doc "Returns immutable image identities attached to one published Article revision."
  def article_images(revision_id) when is_binary(revision_id) do
    from(ref in ArticleAssetRef,
      join: asset in CommunityAsset,
      on: asset.id == ref.asset_id,
      where:
        ref.revision_id == ^revision_id and ref.usage in [:inline, :cover, :cover_dark] and
          asset.status == :active and asset.asset_type == :image,
      order_by: [asc: ref.position, asc: ref.id],
      select: %{
        asset_id: ref.asset_id,
        immutable_version: fragment("COALESCE(?, ?)", asset.content_hash, asset.url_hash)
      }
    )
    |> Repo.all()
  end

  def article_images(_revision_id), do: []

  @doc """
  Attaches ephemeral signed read URLs to persisted image identities immediately before a provider call.

  ## Examples

      attach_signed_urls(%{"images" => []})
      #=> {:ok, %{"images" => []}}
  """
  @spec attach_signed_urls(map()) :: {:ok, map()} | {:error, term()}
  def attach_signed_urls(payload) when is_map(payload) do
    images = Map.get(payload, "images", [])

    with {:ok, signed_images} <- sign_images(images) do
      {:ok, Map.put(payload, "images", signed_images)}
    end
  end

  def attach_signed_urls(_payload) do
    {:error, GroupherServer.AI.unsupported_media_error()}
  end

  defp sign_images(images) when is_list(images) do
    Enum.reduce_while(images, {:ok, []}, fn image, {:ok, signed} ->
      case sign_image(image) do
        {:ok, value} -> {:cont, {:ok, [value | signed]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, signed} -> {:ok, Enum.reverse(signed)}
      {:error, _reason} = error -> error
    end
  end

  defp sign_images(_images), do: {:error, GroupherServer.AI.unsupported_media_error()}

  defp sign_image(%{"asset_id" => asset_id, "immutable_version" => version})
       when is_integer(asset_id) and is_binary(version) do
    case Repo.get(CommunityAsset, asset_id) do
      %CommunityAsset{
        status: :active,
        asset_type: :image,
        storage: "r2",
        storage_key: storage_key,
        mime_type: mime_type,
        size_bytes: size_bytes
      } = asset
      when is_binary(storage_key) and mime_type in @mime_types and size_bytes > 0 and
             size_bytes <= @max_image_bytes ->
        if immutable_version(asset) == version do
          expires_at = DateTime.add(DateTime.utc_now(:second), @read_ttl_seconds, :second)
          expires_at_iso = DateTime.to_iso8601(expires_at)

          token =
            CMS.Assets.Capability.sign(%{
              "assetId" => asset.id,
              "expiresAt" => expires_at_iso,
              "immutableVersion" => version,
              "mimeType" => mime_type,
              "objectKey" => storage_key,
              "purpose" => "review.read"
            })

          url =
            String.trim_trailing(CMS.Assets.Capability.public_endpoint(), "/") <>
              "/review/" <> token

          {:ok, %{asset_id: asset.id, immutable_version: version, signed_read_url: url}}
        else
          {:error, GroupherServer.AI.unsupported_media_error()}
        end

      _ ->
        {:error, GroupherServer.AI.unsupported_media_error()}
    end
  end

  defp sign_image(_image), do: {:error, GroupherServer.AI.unsupported_media_error()}

  defp image_identity(%CommunityAsset{} = asset) do
    %{
      asset_id: asset.id,
      immutable_version: immutable_version(asset)
    }
  end

  defp immutable_version(%CommunityAsset{content_hash: value})
       when is_binary(value) and value != "" do
    value
  end

  defp immutable_version(%CommunityAsset{url_hash: value}), do: value
end
