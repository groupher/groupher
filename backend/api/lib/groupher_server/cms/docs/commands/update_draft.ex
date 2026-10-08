defmodule GroupherServer.CMS.Docs.Commands.UpdateDraft do
  @moduledoc """
  Updates one branch-scoped Doc Draft behind Gate and version checks.

      Doc draft -> Gate/version checks -> draft write -> tagged result
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Docs.Editor
  alias CMS.Model.{Author, Community, DocBranch}

  @spec execute(Ecto.UUID.t(), pos_integer(), map(), User.t() | Author.t()) ::
          {:ok, map()} | {:error, term()}
  def execute(doc_id, branch_id, attrs, actor)
      when is_binary(doc_id) and is_integer(branch_id) and is_map(attrs) do
    attrs = Editor.put_doc_digest(attrs)

    with {:ok, article} <- Editor.stable_doc(doc_id),
         {:ok, author} <- Editor.target_author(actor),
         {:ok, user} <- Editor.actor_user(actor),
         {:ok, community} <- branch_community(branch_id),
         {:ok, draft} <-
           CMS.Gate.Access.with_branch_check(user, :edit, community, article, branch_id, fn canonical ->
             with {:ok, expected_draft_version} <-
                    Editor.ensure_editable_draft(
                      canonical,
                      branch_id,
                      author,
                      Map.fetch!(attrs, :expected_version)
                    ) do
               CMS.Articles.Draft.Store.update(canonical, attrs, author,
                 branch_id: branch_id,
                 expected_version: expected_draft_version
               )
             end
           end) do
      Editor.materialize_draft(draft, article, community)
    end
  end

  defp branch_community(branch_id) do
    case Repo.get(DocBranch, branch_id) do
      %DocBranch{community_id: community_id} ->
        case Repo.get(Community, community_id) do
          %Community{} = community -> {:ok, community}
          _ -> {:error, :article_binding_not_found}
        end

      _ ->
        {:error, :article_binding_not_found}
    end
  end
end
