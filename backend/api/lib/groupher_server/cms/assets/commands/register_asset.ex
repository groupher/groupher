defmodule GroupherServer.CMS.Assets.Commands.RegisterAsset do
  @moduledoc """
  Registers one uploaded asset as a one-shot CMS command.

      upload callback / GraphQL -> RegisterAsset -> Gate -> Writer upsert
  """

  alias GroupherServer.CMS
  alias CMS.Assets.Writer
  alias CMS.ErrorCat
  alias CMS.Model.{Community, CommunityAsset}
  alias GroupherServer.Accounts.Model.User

  @spec execute(Community.t(), map(), User.t() | nil, String.t() | nil) ::
          {:ok, CommunityAsset.t()} | {:error, term()}
  def execute(%Community{} = community, attrs, user, command_id) when is_map(attrs) do
    with {:ok, command_id} <- command_identity(command_id),
         {:ok, asset} <- register_with_admission(community, attrs, user) do
      {:ok, Map.put(asset, :command_id, command_id)}
    end
  end

  defp register_with_admission(community, attrs, %User{} = user) do
    CMS.Gate.with_community_check(user, :update, community, fn canonical ->
      Writer.register(canonical, attrs, user)
    end)
  end

  defp register_with_admission(community, attrs, nil), do: Writer.register(community, attrs)

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
