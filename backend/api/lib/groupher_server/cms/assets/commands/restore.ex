defmodule GroupherServer.CMS.Assets.Commands.Restore do
  @moduledoc """
  Restores one archived asset through a `receipt_pipeline`.

      GraphQL / facade -> Restore -> CMS.Command -> Gate -> Persist -> Confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Assets.Commands.RestoreAssetConfirmation, as: Confirmation
  alias CMS.ErrorCat
  alias CMS.Assets.{Persist, Query}
  alias CMS.Model.{Community, CommunityAsset}

  @spec execute(Community.t(), term(), User.t(), String.t() | nil) ::
          {:ok, CommunityAsset.t()} | {:error, term()}
  def execute(%Community{} = community, asset_id, %User{} = user, command_id) do
    with %CommunityAsset{} = asset <-
           Query.asset(community.id, asset_id),
         {:ok, result} <- execute_pipeline(asset, community, community.id, user, command_id) do
      {:ok, result}
    else
      nil -> {:error, ErrorCat.custom("asset not found")}
      {:error, _reason} = error -> error
    end
  end

  def execute(%Community{}, _asset_id, _user, _command_id), do: {:error, :asset_actor_required}

  @pipeline operation: :asset_restore,
            confirmation: Confirmation,
            target: :asset,
            params: [:community_id]

  receipt_pipeline execute_pipeline(asset, community, community_id, user, command_id) do
    gate(fn candidate ->
      with {:ok, canonical} <- CMS.Gate.check_in_transaction(user, :update, community) do
        {:ok, {canonical, candidate}}
      end
    end)

    change(fn {canonical, candidate}, _operation_ref ->
      Persist.restore(canonical, candidate.id)
    end)

    confirm(fn restored ->
      {:ok, %Confirmation{data: %{"asset_id" => restored.id, "command_id" => command_id}}}
    end)

    present(fn confirmation -> present_result(confirmation) end)
  end

  defp present_result(%Confirmation{data: %{"asset_id" => asset_id, "command_id" => command_id}}) do
    case Query.asset(asset_id) do
      %CommunityAsset{} = asset -> {:ok, Map.put(asset, :command_id, command_id)}
      nil -> {:error, ErrorCat.custom("asset result unavailable")}
    end
  end
end
