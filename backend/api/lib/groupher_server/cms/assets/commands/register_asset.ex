defmodule GroupherServer.CMS.Assets.Commands.RegisterAsset do
  @moduledoc """
  Registers one uploaded asset as a one-shot CMS command.

      upload callback / GraphQL -> RegisterAsset -> Gate -> Writer upsert
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Assets.Commands.RegisterAssetConfirmation, as: Confirmation
  alias CMS.Command
  alias CMS.Assets.Persist
  alias CMS.ErrorCat
  alias CMS.Model.{Community, CommunityAsset}
  alias GroupherServer.Accounts.Model.User

  @spec execute(Community.t(), map(), User.t() | nil, String.t() | nil) ::
          {:ok, CommunityAsset.t()} | {:error, term()}
  def execute(%Community{} = community, attrs, %User{} = user, command_id) when is_map(attrs) do
    with {:ok, command_id} <- command_identity(command_id),
         {:ok, %Confirmation{} = confirmation} <-
           Command.execute(
             %Command{
               actor: user,
               command_id: command_id,
               operation: :asset_register,
               target: community,
               params: %{attrs: attrs}
             },
             action: &register_action/1,
             confirmation: Confirmation
           ) do
      present(confirmation)
    end
  end

  def execute(%Community{}, _attrs, _user, _command_id), do: {:error, :asset_actor_required}

  defp register_action(%{
         actor: user,
         target: community,
         params: %{attrs: attrs},
         command_id: command_id
       }) do
    CMS.Gate.with_community_check(user, :update, community, fn canonical ->
      with {:ok, asset} <- Persist.register(canonical, attrs, user) do
        {:ok,
         %Confirmation{
           data: %{"asset_id" => asset.id, "command_id" => command_id}
         }}
      end
    end)
  end

  defp present(%Confirmation{data: %{"asset_id" => asset_id, "command_id" => command_id}}) do
    case Repo.get(CommunityAsset, asset_id) do
      %CommunityAsset{} = asset -> {:ok, Map.put(asset, :command_id, command_id)}
      nil -> {:error, ErrorCat.custom("asset result unavailable")}
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
