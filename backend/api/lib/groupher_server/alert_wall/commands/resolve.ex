defmodule GroupherServer.AlertWall.Commands.Resolve do
  @moduledoc """
  Resolves one Wall item without changing its CMS or Accounts resource.

  Business position:

      GraphQL reviewer action
        -> Resolve CommandPipeline + Receipt
          -> AlertWall authorization
            -> Persist item action
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{AlertWall, CMS, Repo}
  alias AlertWall.Model.Item
  alias CMS.Command.ConfirmationDefinition
  alias CMS.Model.Community

  @pipeline operation: :alert_wall_resolve_item,
            access: :user,
            target: :item_id,
            params: [:resolution, :expected_version],
            confirmation: __MODULE__.Confirmation

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation containing the canonical command result.

    Business position:

        Resolve CommandPipeline -> Receipt -> canonical AlertWall item result
    """

    use ConfirmationDefinition,
      operation: :alert_wall_resolve_item,
      data_keys: ["item_id", "resolution"],
      field_types: %{"item_id" => :integer, "resolution" => :string}
  end

  @doc "Resolves one item through the shared CommandPipeline Receipt."
  def execute(item_id, resolution, expected_version, actor, command_id)
      when is_integer(item_id) and item_id > 0 and is_binary(resolution) and
             byte_size(resolution) > 0 and is_integer(expected_version) and expected_version > 0 do
    execute_pipeline(item_id, resolution, expected_version, actor, command_id)
  end

  def execute(_item_id, _resolution, _expected_version, _actor, _command_id) do
    {:error, AlertWall.ErrorCat.invalid_item()}
  end

  receipt_pipeline execute_pipeline(item_id, resolution, expected_version, actor, command_id) do
    prepare(fn -> prepare(item_id, resolution, expected_version) end)
    gate(fn prepared -> authorize(prepared, actor) end)
    change(fn prepared -> resolve(prepared, resolution, expected_version, actor, command_id) end)
    confirm(fn confirmation -> {:ok, confirmation} end)
    present(&present_result/1)
  end

  defp prepare(item_id, resolution, expected_version) do
    case Repo.get(Item, item_id) do
      %Item{} = item ->
        if item.status == :open and item.version == expected_version do
          {:ok, %{item: item, resolution: resolution, expected_version: expected_version},
           target: {:alert_item, item.id},
           params: %{resolution: resolution, expected_version: expected_version}}
        else
          {:error, AlertWall.ErrorCat.invalid_item()}
        end

      nil ->
        {:error, AlertWall.ErrorCat.item_not_found()}
    end
  end

  defp authorize(%{item: %Item{community_id: nil}} = prepared, actor) do
    with {:ok, :pass} <- authorize_permission(actor, "review.platform.decide") do
      {:ok, prepared}
    end
  end

  defp authorize(%{item: %Item{community_id: community_id}} = prepared, actor) do
    case Repo.get(Community, community_id) do
      %Community{slug: slug} ->
        with {:ok, :pass} <- authorize_permission(actor, "review.decide", %{community: slug}) do
          {:ok, prepared}
        end

      nil ->
        {:error, AlertWall.ErrorCat.item_not_found()}
    end
  end

  defp authorize_permission(actor, permission, params \\ %{}) do
    case CMS.passport_authorization_check(actor, permission, params) do
      {:ok, true} -> {:ok, :pass}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end

  defp resolve(%{item: item}, resolution, expected_version, actor, command_id) do
    with {:ok, updated} <-
           AlertWall.Persist.resolve_in_transaction(
             item.id,
             resolution,
             command_id,
             actor,
             expected_version
           ) do
      {:ok,
       %Confirmation{
         data: %{"item_id" => updated.id, "resolution" => updated.resolution}
       }}
    end
  end

  defp present_result(%Confirmation{data: %{"item_id" => item_id, "resolution" => resolution}}) do
    {:ok, %{item_id: item_id, resolution: resolution}}
  end

  defp present_result(_confirmation), do: {:error, AlertWall.ErrorCat.invalid_item()}
end
