defmodule GroupherServer.CMS.Review.Commands.Decide do
  @moduledoc """
  Applies an authorized human decision through CMS CommandPipeline and Receipt.

  Business position:

      GraphQL moderator decision
        -> Decide CommandPipeline + Receipt
          -> CMS Gate
            -> CMS.Review.Decisions
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Repo}
  alias CMS.Command.ConfirmationDefinition
  alias CMS.Model.Community

  @pipeline operation: :cms_review_decision,
            access: :user,
            target: :target_key,
            params: [:scope_key, :action],
            confirmation: __MODULE__.Confirmation

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation containing the canonical CMS review decision.

    Business position:

        Decide CommandPipeline -> Receipt -> canonical CMS target decision
    """

    use ConfirmationDefinition,
      operation: :cms_review_decision,
      data_keys: ["target_key", "scope_key", "action"],
      field_types: %{"target_key" => :string, "scope_key" => :string, "action" => :string}
  end

  @doc "Decides one scoped target using the caller's stable command id."
  def execute(target_key, scope_key, action, actor, command_id)
      when is_binary(target_key) and is_binary(scope_key) and
             action in [:approve, :deny, :release] do
    execute_pipeline(target_key, scope_key, action, actor, command_id)
  end

  def execute(_target_key, _scope_key, _action, _actor, _command_id) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  receipt_pipeline execute_pipeline(target_key, scope_key, action, actor, command_id) do
    prepare(fn -> prepare(target_key, scope_key, action) end)
    gate(fn prepared -> authorize(prepared, actor) end)
    change(fn prepared -> apply_decision(prepared, actor, command_id) end)
    confirm(fn confirmation -> {:ok, confirmation} end)
    present(&present_result/1)
  end

  defp prepare(target_key, scope_key, action) do
    with {:ok, community_id} <- scope_community_id(scope_key) do
      {:ok,
       %{
         target_key: target_key,
         scope_key: scope_key,
         community_id: community_id,
         action: action
       },
       target: {:cms_review_scope, "#{target_key}:#{scope_key}"},
       params: %{scope_key: scope_key, action: action}}
    end
  end

  defp authorize(%{scope_key: "platform"} = prepared, actor) do
    with {:ok, :pass} <- authorize_permission(actor, "review.platform.decide") do
      {:ok, prepared}
    end
  end

  defp authorize(%{community_id: community_id} = prepared, actor) when is_integer(community_id) do
    case Repo.get(Community, community_id) do
      %Community{slug: slug} ->
        with {:ok, :pass} <- authorize_permission(actor, "review.decide", %{community: slug}) do
          {:ok, prepared}
        end

      nil ->
        {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp authorize(_prepared, _actor), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp authorize_permission(actor, permission, params \\ %{}) do
    case CMS.Passport.Authorization.check(actor, permission, params) do
      {:ok, true} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp apply_decision(prepared, actor, command_id) do
    case CMS.Review.Decisions.apply_in_transaction(
           prepared.target_key,
           prepared.scope_key,
           prepared.action,
           actor,
           command_id
         ) do
      {:ok, :pass} ->
        {:ok,
         %Confirmation{
           data: %{
             "target_key" => prepared.target_key,
             "scope_key" => prepared.scope_key,
             "action" => Atom.to_string(prepared.action)
           }
         }}

      {:error, _reason} = error ->
        error
    end
  end

  defp present_result(%Confirmation{data: data}), do: {:ok, data}
  defp present_result(_confirmation), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp scope_community_id("platform"), do: {:ok, nil}

  defp scope_community_id("community:" <> value) do
    case Integer.parse(value) do
      {community_id, ""} when community_id > 0 -> {:ok, community_id}
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp scope_community_id(_scope), do: {:error, CMS.ErrorCat.invalid_review_block()}
end
