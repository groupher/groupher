defmodule GroupherServer.CMS.Assets.Commands.DeleteAsset do
  @moduledoc """
  Deletes one unreferenced asset through the Receipt boundary.

      GraphQL / facade -> DeleteAsset -> CMS.Command -> Gate + Persist + Outbox
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Assets.Commands.DeleteAssetConfirmation, as: Confirmation
  alias CMS.Assets.Persist
  alias CMS.Command
  alias CMS.ErrorCat
  alias CMS.Model.{Community, CommunityAsset}

  @spec execute(Community.t(), term(), User.t(), String.t() | nil) ::
          {:ok, CommunityAsset.t()} | {:error, term()}
  def execute(%Community{} = community, asset_id, %User{} = actor, command_id) do
    with {:ok, command_id} <- command_identity(command_id),
         %CommunityAsset{} = asset <-
           Repo.get_by(CommunityAsset, id: asset_id, community_id: community.id) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :asset_delete,
        target: asset,
        params: %{community_id: community.id}
      }

      with {:ok, %Confirmation{} = confirmation} <-
             Command.execute(command, action: &delete_action/1, confirmation: Confirmation) do
        present(confirmation)
      end
    else
      nil -> {:error, ErrorCat.custom("asset not found")}
      {:error, _reason} = error -> error
    end
  end

  def execute(%Community{}, _asset_id, _actor, _command_id),
    do: {:error, :asset_actor_required}

  defp delete_action(%{actor: actor, target: %CommunityAsset{} = asset, command_id: command_id}) do
    community = Repo.get!(Community, asset.community_id)

    CMS.Gate.with_community_check(actor, :update, community, fn canonical ->
      with {:ok, deleted} <- Persist.delete(canonical, asset.id, {:command, command_id}),
           {:ok, _event} <-
             CMS.Outbox.send(%{
               event: "asset.provider_delete",
               worker: CMS.Outbox.Workers.Asset.Cleanup,
               resource_type: "community_asset",
               resource_id: deleted.id,
               identity: {:command, command_id},
               effect_key: "asset:#{deleted.id}",
               data: %{asset_id: deleted.id, public_ref: deleted.public_ref}
             }) do
        {:ok,
         %Confirmation{
           data: %{
             "asset_id" => deleted.id,
             "command_id" => command_id
           }
         }}
      end
    end)
  end

  defp present(%Confirmation{data: %{"asset_id" => asset_id, "command_id" => command_id}}) do
    case Repo.get(CommunityAsset, asset_id) do
      %CommunityAsset{} = asset -> {:ok, Map.put(asset, :command_id, command_id)}
      nil -> {:error, ErrorCat.command_result_unavailable()}
    end
  end

  defp command_identity(command_id) do
    case Ecto.UUID.cast(command_id) do
      {:ok, command_id} ->
        {:ok, command_id}

      :error ->
        if is_nil(command_id),
          do: {:error, ErrorCat.command_id_required()},
          else: {:error, ErrorCat.command_id_invalid()}
    end
  end
end
