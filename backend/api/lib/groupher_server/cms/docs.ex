defmodule GroupherServer.CMS.Docs do
  @moduledoc """
  Public facade for Doc-only branches, snapshots and release publishing.

  Ordinary Post, Blog and Changelog never enter this boundary.

  Docs branch/editor -> snapshot and tree boundaries -> public Docs release
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Command
  alias CMS.Articles.{Diff, Publish}
  alias CMS.Docs.Snapshot
  alias CMS.Model.{Community, DocSnapshot}
  alias Helper.T

  @doc "Reads the current Doc content head shown by the editor; this is not the rich-text editor implementation."
  def read_editor_head(%Community{} = community, doc_id, opts \\ []) do
    CMS.Articles.read_editor_head(community, :doc, doc_id, opts)
  end

  @doc "Compatibility alias for `read_editor_head/3`."
  def read_editor(%Community{} = community, doc_id, opts \\ []) do
    read_editor_head(community, doc_id, opts)
  end

  @doc "Lists immutable revisions for one Doc in the selected branch."
  @spec list_snapshots(Community.t(), T.id(), keyword() | map()) ::
          T.domain_res([DocSnapshot.t()])
  def list_snapshots(%Community{} = community, doc_id, opts \\ []) do
    Snapshot.list(community, :doc, doc_id, opts)
  end

  @doc "Fetches one immutable Doc revision in the selected branch."
  @spec get_snapshot(Community.t(), T.id(), term(), keyword() | map()) ::
          T.domain_res(DocSnapshot.t())
  def get_snapshot(%Community{} = community, doc_id, snapshot_id, opts \\ []) do
    Snapshot.get(community, :doc, doc_id, snapshot_id, opts)
  end

  @doc "Creates a deduplicated checkpoint for the current Doc draft."
  @spec checkpoint_snapshot(Community.t(), T.id(), User.t() | nil, keyword() | map()) ::
          T.domain_res(DocSnapshot.t())
  def checkpoint_snapshot(%Community{} = community, doc_id, user \\ nil, opts \\ []) do
    if match?(%User{}, user) do
      with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
        opts = drop_command_id(opts)

        Command.create_user(user, command_id,
          command: :doc_checkpoint_snapshot,
          resource: :doc,
          owner: community,
          input: %{doc_id: doc_id, opts: opts},
          recovery: fn receipt ->
            Snapshot.get(community, :doc, doc_id, receipt.result_key, opts)
          end
        )
        |> Command.run(fn %{input: %{doc_id: doc_id, opts: opts}} ->
          with {:ok, result} <- Snapshot.checkpoint(community, :doc, doc_id, user, opts) do
            {:ok, result, %{result_key: result.id}}
          end
        end)
      end
    else
      Snapshot.checkpoint(community, :doc, doc_id, user, opts)
    end
  end

  @doc "Restores a Doc revision into the selected branch draft."
  @spec restore_snapshot(
          Community.t(),
          T.id(),
          term(),
          User.t() | nil,
          keyword() | map()
        ) :: T.domain_res(T.article())
  def restore_snapshot(community, doc_id, snapshot_id, user \\ nil, opts \\ []) do
    if match?(%User{}, user) do
      with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
        opts = drop_command_id(opts)

        Command.create_user(user, command_id,
          command: :doc_restore_snapshot,
          resource: :doc,
          owner: community,
          input: %{doc_id: doc_id, snapshot_id: snapshot_id, opts: opts},
          recovery: fn _receipt ->
            CMS.Articles.read_editor_head(community, :doc, doc_id, opts)
          end
        )
        |> Command.run(fn %{
                            input: %{doc_id: doc_id, snapshot_id: snapshot_id, opts: opts}
                          } ->
          with {:ok, result} <-
                 Snapshot.restore(community, :doc, doc_id, snapshot_id, user, opts) do
            {:ok, result, %{result_key: result.article_hash_id}}
          end
        end)
      end
    else
      Snapshot.restore(community, :doc, doc_id, snapshot_id, user, opts)
    end
  end

  @doc "Publishes one Doc draft and returns its immutable Doc revision."
  @spec publish_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(DocSnapshot.t())
  def publish_draft(%Community{} = community, doc_id, %User{} = user, opts \\ []) do
    with {:ok, %{snapshot: snapshot}} <-
           Publish.publish(community, :doc, doc_id, user, opts) do
      {:ok, snapshot}
    end
  end

  @doc "Compares two immutable Doc revisions."
  def diff_snapshots(left, right), do: Diff.compare(left, right)

  @doc "Compares a current Doc Article row to an immutable Doc revision."
  def diff_current(article, snapshot), do: Diff.compare_current(article, snapshot)

  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil
end
