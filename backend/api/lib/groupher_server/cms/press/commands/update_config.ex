defmodule GroupherServer.CMS.Press.Commands.UpdateConfig do
  @moduledoc """
  Updates one Community's Press configuration through the Receipt boundary.

      commandId -> UpdateConfig -> Receipt -> Gate -> Persist -> Activity -> Effects
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS, Activity}

  alias CMS.Gate
  alias CMS.Command.ConfirmationDefinition
  alias CMS.Model.{Community, PressConfig}
  alias CMS.Press.{Effects, Persist, Query}
  alias Accounts.Model.User
  alias Helper.T

  defmodule Confirmation do
    @moduledoc """
    Recovers the stable Press config community and revision after a lost response.

        Press config mutation -> Confirmation -> Press.Query.config
    """

    use ConfirmationDefinition,
      operation: :press_config_update,
      data_keys: ["community", "revision", "command_id"],
      field_types: %{
        "community" => :string,
        "revision" => :integer,
        "command_id" => :string
      }
  end

  @spec execute(Community.t() | String.t(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(PressConfig.t() | map())
  def execute(community_ref, attrs, %User{} = actor, command_id) do
    with {:ok, community} <- Query.internal_community(community_ref) do
      execute_pipeline(community, attrs, actor, command_id)
    end
  end

  @pipeline operation: :press_config_update,
            confirmation: Confirmation,
            target: :community,
            params: [:attrs]

  receipt_pipeline execute_pipeline(community, attrs, actor, command_id) do
    gate(fn candidate -> Gate.check_in_transaction(actor, :update, candidate) end)

    change(fn canonical, operation_ref ->
      with {:ok, current} <- Query.config(canonical),
           changeset = Persist.changeset(canonical, current, attrs),
           {:ok, config} <- Persist.insert_or_update(changeset),
           changed_payload = Map.take(changeset.changes, config_fields()),
           {:ok, _activity} <-
             Activity.log(config, :config_updated,
               actor: actor,
               source: :admin,
               operation_ref: operation_ref,
               stream_ref: canonical.slug,
               occurred_at: config.updated_at,
               payload: changed_payload,
               changed_fields: Map.keys(changed_payload),
               metadata: %{revision: config.revision}
             ),
           {:ok, _effect} <- Effects.enqueue_invalidation(canonical, operation_ref) do
        {:ok, config}
      end
    end)

    confirm(fn %PressConfig{revision: revision} ->
      {:ok,
       %Confirmation{
         data: %{
           "community" => community.slug,
           "revision" => revision,
           "command_id" => command_id
         }
       }}
    end)

    present(fn confirmation ->
      with {:ok, _effect} <- Effects.ensure_invalidation(community, command_id) do
        present_result(confirmation)
      end
    end)
  end

  defp present_result(%Confirmation{data: %{"community" => community}}) do
    Query.config(community)
  end

  defp present_result(_confirmation) do
    {:error, CMS.ErrorCat.command_result_unavailable()}
  end

  defp config_fields do
    [
      :markdown_enabled,
      :feed_enabled,
      :feed_type,
      :feed_count,
      :feed_threads,
      :llms_enabled,
      :sitemap_enabled
    ]
  end
end
