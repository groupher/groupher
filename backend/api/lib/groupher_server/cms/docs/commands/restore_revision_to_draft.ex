defmodule GroupherServer.CMS.Docs.Commands.RestoreRevisionToDraft do
  @moduledoc """
  Restores one published Doc revision into the mutable branch workspace.

      published revision -> branch workspace -> tagged Draft result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat

  alias Accounts.Model.User
  alias CMS.Docs.{BranchVersions, Editor}
  alias CMS.Model.{Author, Community}

  @spec execute(Ecto.UUID.t(), pos_integer(), Ecto.UUID.t(), User.t() | Author.t(), keyword()) ::
          {:ok, CMS.Model.DocDraft.t()} | {:error, term()}
  def execute(doc_id, branch_id, revision_id, actor, opts)
      when is_binary(doc_id) and is_binary(revision_id) do
    execute_pipeline(doc_id, branch_id, revision_id, actor, opts)
  end

  @pipeline operation: :doc_restore_revision_to_draft, target: :doc_id
  direct_pipeline execute_pipeline(doc_id, branch_id, revision_id, actor, opts) do
    prepare(fn ->
      with {:ok, article} <- Editor.stable_doc(doc_id),
           {:ok, author} <- Editor.target_author(actor),
           {:ok, user} <- Editor.actor_user(actor),
           %Community{} = community <- Keyword.get(opts, :community) do
        {:ok, {article, author, user, community}}
      else
        nil -> {:error, ArticleErrorCat.binding_context_required()}
        {:error, _reason} = error -> error
      end
    end)

    gate(fn {article, author, user, community} ->
      with {:ok, canonical} <-
             CMS.Gate.check_in_transaction(
               user,
               :restore_revision_to_draft,
               article,
               community,
               branch_id
             ) do
        {:ok, {canonical, author}}
      end
    end)

    change(fn {canonical, author} ->
      BranchVersions.restore_revision_to_draft(
        canonical,
        branch_id,
        revision_id,
        author,
        opts
      )
    end)
  end
end
