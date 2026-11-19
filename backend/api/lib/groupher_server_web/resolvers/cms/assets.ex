defmodule GroupherServerWeb.Resolvers.CMS.Assets do
  @moduledoc """
  Adapts asset GraphQL fields to CMS asset use cases and transport errors.

      GraphQL asset field -> this resolver -> CMS.Assets facade
  """
  require GroupherServer.CMS.Assets.ErrorCat

  alias GroupherServer.Pagi
  alias GroupherServer.CMS
  alias CMS.Assets.ErrorCat, as: AssetErrorCat
  alias CMS.Model.Community

  def paged_community_assets(_root, %{community: %Community{} = community} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.assets_page(community, Map.get(args, :filter), pagi)
    end
  end

  def community_asset_refs(
        _root,
        %{community: %Community{} = community, asset_id: asset_id} = args,
        info
      ) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.assets_refs(community, asset_id, pagi, Map.get(info.context, :cur_user))
    end
  end

  def community_asset_usage(_root, %{community: %Community{} = community}, _info) do
    CMS.assets_usage(community)
  end

  def community_asset_stats(_root, %{community: %Community{} = community} = args, _info) do
    CMS.assets_stats(community, Map.get(args, :filter))
  end

  def community_asset_origin_info(_root, %{public_ref: public_ref}, _info) do
    case CMS.assets_origin_info(public_ref) do
      {:ok, asset} -> {:ok, asset}
      {:error, AssetErrorCat.error_pattern(reason: :not_exist)} -> {:ok, nil}
      {:error, reason} -> {:error, reason}
    end
  end

  def wallpaper_batch_published(_root, %{batch_ref: batch_ref}, _info) do
    {:ok, CMS.wallpaper_batch_published?(batch_ref)}
  end

  def register_community_asset(
        _root,
        %{community: %Community{} = community, asset: asset} = args,
        %{
          context: %{cur_user: user}
        }
      ) do
    CMS.assets_register_to_community(community, asset, user, Map.get(args, :command_id))
  end

  def create_community_asset_upload_intent(
        _root,
        %{community: %Community{} = community, file: file},
        %{context: %{cur_user: user}}
      ) do
    CMS.assets_create_upload_intent(community, file, user)
  end

  def complete_community_asset_upload(_root, %{input: input}, _info) do
    CMS.assets_complete_upload(input)
  end

  def delete_community_asset(
        _root,
        %{community: %Community{} = community, id: id, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.assets_delete(community, id, user, command_id)
  end
end
