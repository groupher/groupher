defmodule GroupherServer.CMS.Assets.Persist do
  @moduledoc """
  Persistence primitives for user-owned CommunityAsset mutations.

  Gate/Command owns admission and the surrounding transaction. This module only
  locks and writes the canonical asset row and emits the provider-delete
  outbox intent with the identity supplied by its caller.

      Command / maintenance workflow
        -> Gate / workflow transaction
        -> Assets.Persist
        -> community_assets
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Assets.Completeness
  alias CMS.Assets.ErrorCat, as: AssetErrorCat
  alias CMS.Model.{ArticleAssetRef, Community, CommunityAsset}
  alias Helper.ORM

  @asset_url_conflict_target {:unsafe_fragment,
                              "(community_id, url_hash) WHERE deleted_at IS NULL"}
  @asset_storage_conflict_target {:unsafe_fragment,
                                  "(community_id, storage, storage_key) WHERE storage_key IS NOT NULL AND deleted_at IS NULL"}

  @spec register(Community.t(), map(), User.t() | nil) ::
          {:ok, CommunityAsset.t()} | {:error, term()}
  def register(%Community{id: community_id}, attrs, user \\ nil) when is_map(attrs) do
    attrs =
      attrs
      |> Map.put(:community_id, community_id)
      |> put_uploader(user)
      |> put_default_status()
      |> put_default_asset_type()
      |> Map.put_new(:archived_at, nil)

    upsert_active_asset(attrs)
  end

  @spec delete(Community.t(), term(), {:command | :workflow, String.t()}) ::
          {:ok, CommunityAsset.t()} | {:error, term()}
  def delete(%Community{id: community_id}, asset_id, _identity) do
    with {:ok, asset} <- find_active_asset_for_update(community_id, asset_id),
         {:ok, _} <- Completeness.guard(community_id),
         false <- referenced?(asset),
         {:ok, asset} <-
           ORM.update(asset, %{status: :deleted, deleted_at: DateTime.utc_now(:second)}) do
      {:ok, asset}
    else
      true -> {:error, AssetErrorCat.custom("asset is still referenced")}
      {:error, reason} -> {:error, reason}
    end
  end

  def archive(%Community{id: community_id}, asset_id) do
    with {:ok, asset} <- find_active_asset_for_update(community_id, asset_id),
         {:ok, archived} <-
           ORM.update(asset, %{status: :archived, archived_at: DateTime.utc_now(:second)}) do
      {:ok, archived}
    end
  end

  def restore(%Community{id: community_id}, asset_id) do
    with {:ok, asset} <- find_asset_for_update(community_id, asset_id),
         {:ok, restored} <-
           ORM.update(asset, %{status: :active, archived_at: nil, deleted_at: nil}) do
      {:ok, restored}
    end
  end

  defp find_active_asset_for_update(community_id, asset_id) do
    community_id
    |> CommunityAsset.active_query(asset_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, AssetErrorCat.not_exist("asset not found")}
      asset -> {:ok, asset}
    end
  end

  defp find_asset_for_update(community_id, asset_id) do
    CommunityAsset
    |> where([asset], asset.community_id == ^community_id and asset.id == ^asset_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, AssetErrorCat.not_exist("asset not found")}
      asset -> {:ok, asset}
    end
  end

  defp upsert_active_asset(attrs) do
    attrs
    |> upsert_identity()
    |> then(&insert_active_asset(attrs, &1))
    |> case do
      {:ok, asset} -> {:ok, asset}
      {:error, %Ecto.Changeset{} = changeset} -> retry_active_asset_upsert(attrs, changeset)
    end
  end

  defp insert_active_asset(attrs, identity) do
    changeset = CommunityAsset.changeset(%CommunityAsset{}, attrs)

    set_fields =
      changeset.changes
      |> Map.drop(conflict_fields(identity))
      |> Map.put(:updated_at, DateTime.utc_now(:second))
      |> Enum.to_list()

    opts = [
      on_conflict: [set: set_fields],
      conflict_target: conflict_target(identity),
      returning: true
    ]

    opts = if Repo.in_transaction?(), do: Keyword.put(opts, :mode, :savepoint), else: opts
    Repo.insert(changeset, opts)
  end

  defp retry_active_asset_upsert(attrs, changeset) do
    cond do
      unique_constraint_error?(changeset, :community_assets_community_url_hash_index) ->
        insert_active_asset(attrs, :url_hash)

      storage_identity?(attrs) and
          unique_constraint_error?(changeset, :community_assets_community_storage_key_index) ->
        insert_active_asset(attrs, :storage_key)

      true ->
        {:error, changeset}
    end
  end

  defp upsert_identity(attrs), do: if(storage_identity?(attrs), do: :storage_key, else: :url_hash)

  defp storage_identity?(attrs),
    do: is_binary(get_attr(attrs, :storage)) and is_binary(get_attr(attrs, :storage_key))

  defp conflict_target(:storage_key), do: @asset_storage_conflict_target
  defp conflict_target(:url_hash), do: @asset_url_conflict_target
  defp conflict_fields(:storage_key), do: [:community_id, :storage, :storage_key]
  defp conflict_fields(:url_hash), do: [:community_id, :url_hash]

  defp unique_constraint_error?(%Ecto.Changeset{errors: errors}, constraint_name) do
    constraint_name = to_string(constraint_name)

    Enum.any?(errors, fn {_field, {_message, opts}} ->
      opts[:constraint] == :unique and opts[:constraint_name] == constraint_name
    end)
  end

  defp referenced?(%CommunityAsset{id: asset_id}) do
    ArticleAssetRef |> where([ref], ref.asset_id == ^asset_id) |> Repo.exists?()
  end

  defp put_uploader(attrs, %User{id: user_id}), do: Map.put(attrs, :uploader_id, user_id)
  defp put_uploader(attrs, _), do: attrs

  defp put_default_status(attrs),
    do: if(has_attr?(attrs, :status), do: attrs, else: Map.put(attrs, :status, :active))

  defp put_default_asset_type(attrs),
    do:
      if(has_attr?(attrs, :asset_type),
        do: attrs,
        else: Map.put(attrs, :asset_type, guessed_asset_type(get_attr(attrs, :mime_type)))
      )

  defp guessed_asset_type("image/" <> _), do: :image
  defp guessed_asset_type("video/" <> _), do: :video
  defp guessed_asset_type("audio/" <> _), do: :audio
  defp guessed_asset_type(_), do: :file
  defp get_attr(attrs, key), do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))

  defp has_attr?(attrs, key),
    do: Map.has_key?(attrs, key) or Map.has_key?(attrs, Atom.to_string(key))
end
