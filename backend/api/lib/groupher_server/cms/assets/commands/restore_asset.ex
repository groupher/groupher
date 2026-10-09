defmodule GroupherServer.CMS.Assets.Commands.RestoreAsset do
  @moduledoc """
  Restores one archived asset as a one-shot CMS command.

      GraphQL / facade -> RestoreAsset -> Gate -> Writer -> canonical Asset
  """

  alias GroupherServer.CMS
  alias CMS.Assets.Writer
  alias CMS.ErrorCat
  alias CMS.Model.{Community, CommunityAsset}
  alias GroupherServer.Accounts.Model.User

  @spec execute(Community.t(), term(), User.t(), String.t() | nil) ::
          {:ok, CommunityAsset.t()} | {:error, term()}
  def execute(%Community{} = community, asset_id, %User{} = user, command_id) do
    with {:ok, command_id} <- command_identity(command_id),
         {:ok, asset} <-
           CMS.Gate.with_community_check(user, :update, community, fn canonical ->
             case Writer.restore(canonical, asset_id) do
               {:ok, asset} -> {:ok, asset}
               {:error, reason} -> {:error, reason}
             end
           end) do
      {:ok, Map.put(asset, :command_id, command_id)}
    end
  end

  def execute(%Community{}, _asset_id, _user, _command_id), do: {:error, :asset_actor_required}

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
