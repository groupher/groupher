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

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Command
  alias CMS.DocTree.{CommandReplay, Publish}
  alias CMS.Model.Community
  alias Helper.T

  @doc "Publishes selected Docs changes under a stable command id."
  @spec publish_changes(Community.t(), map(), User.t(), keyword()) :: T.domain_res(map())
  def publish_changes(%Community{} = community, args, %User{} = user, opts) do
    params = drop_command_id(args)
    publish_opts = drop_command_id(opts)

    case option(opts, :command_id) do
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
          action: fn %{params: params} ->
            with {:ok, result} <- Publish.publish_changes(community, params, user, publish_opts) do
              result_key = if result.release, do: result.release.id
              {:ok, result, %{result_key: result_key}}
            end
          end,
          result: &publish_result(&1, community, params)
        )
    end
  end

  defp publish_result(receipt, community, args) do
    case Publish.checklist(community, args) do
      {:error, reason} ->
        {:error, reason}

      checklist ->
        {:ok,
         %{
           done: true,
           release: release(receipt.result_key),
           checklist: checklist,
           scope: %{total_count: checklist.total_count}
         }}
    end
  end

  defp release(nil), do: nil

  defp release(release_id) do
    case CMS.Docs.Reader.publish_release(release_id) do
      {:ok, release} -> release
      {:error, _reason} -> nil
    end
  end

  @doc "Moves one public Docs page back to Draft visibility."
  @spec move_doc_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(CMS.Model.DocDraft.t() | map())
  def move_doc_to_draft(%Community{} = community, id, %User{} = user, opts) do
    run_doc_command(
      community,
      id,
      user,
      :doc_move_to_draft,
      opts,
      fn ->
        with {:ok, draft} <- Publish.move_doc_to_draft(community, id, user, opts) do
          {:ok, draft, %{result_key: draft.article_id}}
        end
      end,
      fn receipt ->
        CMS.Docs.read_editor_head(community, receipt.result_key, opts)
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
    case option(opts, :command_id) do
      nil ->
        execute_one_shot(execute)

      command_id ->
        %Command{
          actor: user,
          command_id: command_id,
          operation: command,
          target: {:doc, community.id},
          params: %{id: id, opts: drop_command_id(opts)}
        }
        |> Command.execute(
          action: fn _context -> execute.() end,
          result: replay
        )
    end
  end

  defp execute_one_shot(execute) do
    case execute.() do
      {:ok, result, _receipt_metadata} -> {:ok, result}
      other -> other
    end
  end

  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil
end
