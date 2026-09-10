defmodule GroupherServer.CMS.DocTree.Commands.Publish do
  @moduledoc """
  Runs receipt-backed Docs publish and return-to-Draft commands.

  Publish orchestration remains in `DocTree.Publish`; this module owns only
  command identity, replay, and authoritative result reconstruction.

  Business position:

      CMS.DocTree facade
        -> Commands.Publish
        -> CommandReceipt / CommandReplay
        -> DocTree.Publish / Reader
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.CommandReceipt
  alias CMS.DocPublishRelease
  alias CMS.DocTree.{CommandReplay, Publish, Reader}
  alias CMS.Model.{Community, Doc}
  alias Helper.T

  @doc "Publishes selected Docs changes under a stable command key."
  @spec publish_changes(Community.t(), map(), User.t(), keyword()) :: T.domain_res(map())
  def publish_changes(%Community{} = community, args, %User{} = user, opts) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts, args) do
      args = drop_command_key(args)
      opts = drop_command_key(opts)

      CommandReceipt.run_user_command(
        user,
        command_key,
        "doc.publish_changes",
        "doc_branch",
        "#{community.id}:#{Map.get(args, :branch_id, "main")}",
        args,
        fn ->
          with {:ok, result} <- Publish.publish_changes(community, args, user, opts) do
            result_key = if result.release, do: result.release.id
            {:ok, result, %{result_key: result_key}}
          end
        end,
        fn receipt ->
          case Publish.checklist(community, opts) do
            {:error, reason} ->
              {:error, reason}

            checklist ->
              release = if receipt.result_key, do: Repo.get(DocPublishRelease, receipt.result_key)

              {:ok,
               %{
                 done: true,
                 release: release,
                 checklist: checklist,
                 scope: %{total_count: checklist.total_count}
               }}
          end
        end
      )
    end
  end

  @doc "Moves one public Docs page back to Draft visibility."
  @spec move_doc_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(Doc.t())
  def move_doc_to_draft(%Community{} = community, id, %User{} = user, opts) do
    run_doc_command(
      community,
      id,
      user,
      "doc.move_to_draft",
      opts,
      fn -> Publish.move_doc_to_draft(community, id, user, opts) end,
      fn _receipt -> Reader.read_draft(community, id, opts) end
    )
  end

  @doc "Creates Drafts for every published Page in one subtree."
  @spec move_subtree_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(map())
  def move_subtree_to_draft(%Community{} = community, id, %User{} = user, opts) do
    run_doc_command(
      community,
      id,
      user,
      "doc.move_subtree_to_draft",
      opts,
      fn ->
        with {:ok, result} <- Publish.move_subtree_to_draft(community, id, user, opts) do
          {:ok, result, CommandReplay.subtree_metadata(result)}
        end
      end,
      &CommandReplay.replay_subtree/1
    )
  end

  defp run_doc_command(community, id, user, command_name, opts, execute, replay) do
    with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts) do
      opts = drop_command_key(opts)

      CommandReceipt.run_user_command(
        user,
        command_key,
        command_name,
        "doc",
        "#{community.id}:#{id}",
        opts,
        execute,
        replay
      )
    end
  end

  defp drop_command_key(opts) when is_map(opts), do: Map.delete(opts, :command_key)
  defp drop_command_key(opts) when is_list(opts), do: Keyword.delete(opts, :command_key)
  defp drop_command_key(opts), do: opts
end
