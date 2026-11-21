defmodule GroupherServer.CMS.Assets.Commands.Register do
  @moduledoc """
  Registers one uploaded asset through a `receipt_pipeline`.

      upload callback / GraphQL -> Register -> CMS.Command -> Gate -> Persist -> Confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Assets.Commands.RegisterAssetConfirmation, as: Confirmation
  alias CMS.ErrorCat
  alias CMS.Assets.{Persist, Query}
  alias CMS.Model.{Community, CommunityAsset}

  @spec execute(Community.t(), map(), User.t() | nil, String.t() | nil) ::
          {:ok, CommunityAsset.t()} | {:error, term()}
  def execute(%Community{} = community, attrs, %User{} = user, command_id) when is_map(attrs) do
    execute_pipeline(community, attrs, user, command_id)
  end

  def execute(%Community{}, _attrs, _user, _command_id), do: {:error, :asset_actor_required}

  @pipeline operation: :asset_register,
            confirmation: Confirmation,
            target: :community,
            params: [:attrs]

  receipt_pipeline execute_pipeline(community, attrs, user, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(user, :update, candidate) end)
    change(fn canonical, _operation_ref -> Persist.register(canonical, attrs, user) end)

    confirm(fn asset ->
      {:ok, %Confirmation{data: %{"asset_id" => asset.id, "command_id" => command_id}}}
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
