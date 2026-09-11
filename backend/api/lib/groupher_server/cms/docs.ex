defmodule GroupherServer.CMS.Docs do
  @moduledoc """
  Public facade for Doc-only branches, snapshots and release publishing.

  Ordinary Post, Blog and Changelog never enter this boundary.

  Docs branch/editor -> snapshot and tree boundaries -> public Docs release
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.CommandReceipt
  alias CMS.Articles.Diff
  alias CMS.Articles.Publish
  alias CMS.Docs.Snapshot
  alias GroupherServer.CMS.Model.{Community, DocSnapshot}
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
      with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts) do
        opts = drop_command_key(opts)

        CommandReceipt.run_user_command(
          user,
          command_key,
          "doc.checkpoint_snapshot",
          "doc",
          "#{community.id}:#{doc_id}",
          opts,
          fn ->
            with {:ok, result} <- Snapshot.checkpoint(community, :doc, doc_id, user, opts) do
              {:ok, result, %{result_key: result.id}}
            end
          end,
          fn receipt ->
            Snapshot.get(community, :doc, doc_id, receipt.result_key, opts)
          end
        )
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
      with {:ok, command_key} <- CommandReceipt.resolve_command_key(opts) do
        opts = drop_command_key(opts)

        CommandReceipt.run_user_command(
          user,
          command_key,
          "doc.restore_snapshot",
          "doc",
          "#{community.id}:#{doc_id}:#{snapshot_id}",
          opts,
          fn ->
            with {:ok, result} <-
                   Snapshot.restore(community, :doc, doc_id, snapshot_id, user, opts) do
              {:ok, result, %{result_key: result.article_hash_id}}
            end
          end,
          fn _receipt -> CMS.Articles.read_editor_head(community, :doc, doc_id, opts) end
        )
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

  defp drop_command_key(opts) when is_map(opts), do: Map.delete(opts, :command_key)
  defp drop_command_key(opts) when is_list(opts), do: Keyword.delete(opts, :command_key)
  defp drop_command_key(opts), do: opts
end
