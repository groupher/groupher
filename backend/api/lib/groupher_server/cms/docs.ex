defmodule GroupherServer.CMS.Docs do
  @moduledoc """
  Public facade for Doc-only branches, snapshots and release publishing.

      Docs facade
        -> Query / BranchVersions
        -> Commands.*
        -> DraftResult / Projection / domain owners
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.Docs.{BranchVersions, Editor}
  alias CMS.Docs.Commands.{PublishBranch, RestoreRevisionToDraft, UpdateDraft}
  alias CMS.Model.{Author, Community}

  @doc "Reads the current Doc content head shown by the editor."
  def read_editor_head(%Community{} = community, doc_id, opts \\ []) do
    Editor.read_head(community, doc_id, opts)
  end

  @doc "Updates one branch-scoped stable Doc Draft through the command boundary."
  @spec update_draft(Ecto.UUID.t(), pos_integer(), map(), User.t() | Author.t()) ::
          {:ok, CMS.Model.DocDraft.t()} | {:error, term()}
  def update_draft(doc_id, branch_id, attrs, actor) do
    UpdateDraft.execute(doc_id, branch_id, attrs, actor)
  end

  @doc "Publishes a stable Doc Article into one durable branch version."
  @spec publish_branch(Ecto.UUID.t(), pos_integer(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def publish_branch(doc_id, branch_id, actor, opts) do
    PublishBranch.execute(doc_id, branch_id, actor, opts)
  end

  @doc "Lists durable published versions scoped to one stable Doc branch."
  @spec list_branch_versions(Ecto.UUID.t(), pos_integer(), keyword()) ::
          {:ok, [map()]} | {:error, term()}
  def list_branch_versions(doc_id, branch_id, opts \\ []) when is_binary(doc_id) do
    with {:ok, article} <- Editor.stable_doc(doc_id) do
      {:ok, BranchVersions.list(article, branch_id, opts)}
    end
  end

  @doc "Gets one durable version and its composed immutable Doc content."
  @spec get_branch_version(Ecto.UUID.t(), pos_integer(), pos_integer()) ::
          {:ok, map()} | {:error, :not_found}
  def get_branch_version(doc_id, branch_id, branch_version_id)
      when is_binary(doc_id) and is_integer(branch_version_id) do
    with {:ok, article} <- Editor.stable_doc(doc_id) do
      BranchVersions.get(article, branch_id, branch_version_id)
    end
  end

  @doc "Diffs two durable published versions in the same Doc branch."
  @spec diff_versions(Ecto.UUID.t(), pos_integer(), pos_integer(), pos_integer()) ::
          {:ok, map()} | {:error, :not_found}
  def diff_versions(doc_id, branch_id, left_branch_version_id, right_branch_version_id)
      when is_binary(doc_id) and is_integer(left_branch_version_id) and
             is_integer(right_branch_version_id) do
    with {:ok, article} <- Editor.stable_doc(doc_id) do
      BranchVersions.diff(article, branch_id, left_branch_version_id, right_branch_version_id)
    end
  end

  @doc "Restores a published Revision into the mutable workspace without moving Public."
  @spec restore_revision_to_draft(
          Ecto.UUID.t(),
          pos_integer(),
          Ecto.UUID.t(),
          User.t() | Author.t(),
          keyword()
        ) ::
          {:ok, CMS.Model.DocDraft.t()} | {:error, term()}
  def restore_revision_to_draft(doc_id, branch_id, revision_id, actor, opts \\ []) do
    RestoreRevisionToDraft.execute(doc_id, branch_id, revision_id, actor, opts)
  end
end
