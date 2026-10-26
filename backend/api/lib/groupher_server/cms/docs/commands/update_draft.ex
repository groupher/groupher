defmodule GroupherServer.CMS.Docs.Commands.UpdateDraft do
  @moduledoc """
  Updates one branch-scoped Doc Draft behind Gate and version checks.

      Doc draft -> Gate/version checks -> draft write -> tagged result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Docs.Editor
  alias CMS.Model.Author

  @spec execute(Ecto.UUID.t(), pos_integer(), map(), User.t() | Author.t()) ::
          {:ok, map()} | {:error, term()}
  def execute(doc_id, branch_id, attrs, actor)
      when is_binary(doc_id) and is_integer(branch_id) and is_map(attrs) do
    execute_pipeline(doc_id, branch_id, attrs, actor)
  end

  @pipeline operation: :doc_update_draft_write, target: :doc_id
  direct_pipeline execute_pipeline(doc_id, branch_id, attrs, actor) do
    prepare(fn -> prepare_update(doc_id, branch_id, attrs, actor) end)

    gate(fn prepared -> authorize_update(prepared, branch_id) end)

    change(fn authorized -> apply_update(authorized, branch_id) end)
  end

  @doc "Updates a Doc Draft after an enclosing Command gate admitted the Community write."
  def execute_after_gate(doc_id, branch_id, attrs, actor) do
    with {:ok, prepared} <- prepare_update(doc_id, branch_id, attrs, actor),
         true <-
           GroupherServer.Repo.in_transaction?() ||
             {:error, :pipeline_transaction_required} do
      apply_prepared_update(prepared, branch_id)
    end
  end

  defp prepare_update(doc_id, branch_id, attrs, actor) do
    attrs = Editor.put_doc_digest(attrs)

    with {:ok, article} <- Editor.stable_doc(doc_id),
         {:ok, author} <- Editor.target_author(actor),
         {:ok, user} <- Editor.actor_user(actor),
         {:ok, community} <- branch_community(branch_id) do
      {:ok, {article, author, user, community, attrs}}
    end
  end

  defp authorize_update({article, author, user, community, attrs}, branch_id) do
    with {:ok, canonical} <-
           CMS.Gate.check_in_transaction(user, :edit, article, community, branch_id) do
      {:ok, {canonical, article, author, community, attrs}}
    end
  end

  defp apply_update({canonical, article, author, community, attrs}, branch_id) do
    with {:ok, expected_draft_version} <-
           Editor.ensure_editable_draft(
             canonical,
             branch_id,
             author,
             Map.fetch!(attrs, :expected_version)
           ),
         {:ok, draft} <-
           CMS.Articles.Draft.Store.update_loaded(canonical, attrs, author,
             branch_id: branch_id,
             expected_version: expected_draft_version
           ) do
      Editor.materialize_draft(draft, article, community)
    end
  end

  defp apply_prepared_update({article, author, _user, community, attrs}, branch_id) do
    apply_update({article, article, author, community, attrs}, branch_id)
  end

  defp branch_community(branch_id) do
    with {:ok, %{community_id: community_id}} <- CMS.Docs.Store.branch_context(branch_id),
         {:ok, community} <- CMS.FrontDesk.community(community_id, mode: :internal) do
      {:ok, community}
    end
  end
end
