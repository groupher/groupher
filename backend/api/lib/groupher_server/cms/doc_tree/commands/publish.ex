defmodule GroupherServer.CMS.DocTree.Commands.Publish do
  @moduledoc """
  Runs receipt-backed Docs publish and return-to-Draft commands.

  Publish orchestration remains in `DocTree.Publish`; this module owns only
  command identity, replay, and authoritative result reconstruction.

  Business position:

      CMS.DocTree facade
        -> Commands.Publish
        -> CMS.Command / CommandReplay
        -> DocTree.Publish / Reader
  """

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Command
  alias CMS.DocTree.{CommandReplay, Publish}
  alias CMS.Model.{Community, Doc, DocPublishRelease}
  alias Helper.T

  @doc "Publishes selected Docs changes under a stable command id."
  @spec publish_changes(Community.t(), map(), User.t(), keyword()) :: T.domain_res(map())
  def publish_changes(%Community{} = community, args, %User{} = user, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      args = drop_command_id(args)
      opts = drop_command_id(opts)

      Command.create_user(user, command_id,
        command: :doc_publish_changes,
        resource: :doc_branch,
        owner: community,
        input: args,
        recovery: fn receipt ->
          case Publish.checklist(community, args) do
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
      |> Command.run(fn %{input: args} ->
        with {:ok, result} <- Publish.publish_changes(community, args, user, opts) do
          result_key = if result.release, do: result.release.id
          {:ok, result, %{result_key: result_key}}
        end
      end)
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
      :doc_move_to_draft,
      opts,
      fn ->
        with {:ok, doc} <- Publish.move_doc_to_draft(community, id, user, opts) do
          {:ok, doc, %{result_key: doc.article_hash_id}}
        end
      end,
      fn receipt ->
        CMS.Articles.Draft.read_command_result(community, :doc, receipt.result_key, opts)
      end
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
      :doc_move_subtree_to_draft,
      opts,
      fn ->
        with {:ok, result} <- Publish.move_subtree_to_draft(community, id, user, opts) do
          {:ok, result, CommandReplay.subtree_metadata(result)}
        end
      end,
      &CommandReplay.replay_subtree/1
    )
  end

  defp run_doc_command(community, id, user, command, opts, execute, replay) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      opts = drop_command_id(opts)

      Command.create_user(user, command_id,
        command: command,
        resource: :doc,
        owner: community,
        input: %{id: id, opts: opts},
        recovery: replay
      )
      |> Command.run(fn %{input: %{opts: _opts}} -> execute.() end)
    end
  end

  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil
end
