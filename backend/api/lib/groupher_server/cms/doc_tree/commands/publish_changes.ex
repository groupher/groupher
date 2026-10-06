defmodule GroupherServer.CMS.DocTree.Commands.PublishChanges do
  @moduledoc """
  Publishes selected Docs changes under an optional stable command id.

      CMS.DocTree.publish_changes
        -> PublishChanges.execute
        -> CMS.Command when command_id exists -> DocTree.Publish
  """

  alias GroupherServer.CMS
  alias CMS.Command
  alias CMS.DocTree.{Commands.Support, Publish}
  alias CMS.DocTree.Commands.PublishChangesConfirmation, as: Confirmation

  def execute(community, args, user, opts) do
    params = Support.drop_command_id(args)
    publish_opts = Support.drop_command_id(opts)

    case Support.option(opts, :command_id) do
      nil ->
        Publish.publish_changes(community, params, user, publish_opts)

      command_id ->
        %Command{
          actor: user,
          command_id: command_id,
          operation: :doc_publish_changes,
          target: {:doc_branch, community.id},
          params: params
        }
        |> Command.execute(
          action: fn %{params: command_params} ->
            with {:ok, result} <-
                   Publish.publish_changes(community, command_params, user, publish_opts) do
              {:ok,
               %Confirmation{
                 data: %{
                   "release_id" =>
                     if(result.release, do: to_string(result.release.id), else: nil),
                   "done" => true
                 }
               }}
            end
          end,
          confirmation: Confirmation
        )
        |> then(fn
          {:ok, confirmation} -> present(confirmation, community, params)
          error -> error
        end)
    end
  end

  defp present(%Confirmation{data: data}, community, args) do
    case Publish.checklist(community, args) do
      {:error, reason} ->
        {:error, reason}

      checklist ->
        {:ok,
         %{
           done: true,
           release: release(data["release_id"]),
           checklist: checklist,
           scope: %{total_count: checklist.total_count}
         }}
    end
  end

  defp release(nil), do: nil

  defp release(release_id) do
    case CMS.Docs.Store.publish_release(release_id) do
      {:ok, release} -> release
      {:error, _reason} -> nil
    end
  end
end
