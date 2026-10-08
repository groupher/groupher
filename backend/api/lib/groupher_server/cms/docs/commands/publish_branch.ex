defmodule GroupherServer.CMS.Docs.Commands.PublishBranch do
  @moduledoc """
  Publishes one stable Doc branch and runs post-publish effects.

      Doc branch -> atomic publish -> public projection -> effects
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.Publish.{Doc, Effects}
  alias CMS.Docs.Editor
  alias CMS.Model.{Author, Community, DocBranch}

  @spec execute(Ecto.UUID.t(), pos_integer(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def execute(doc_id, branch_id, actor, opts) when is_binary(doc_id) do
    with {:ok, article} <- Editor.stable_doc(doc_id),
         {:ok, author} <- Editor.target_author(actor),
         {:ok, user} <- Editor.actor_user(actor),
         {:ok, community} <- branch_community(branch_id, opts),
         {:ok, result} <-
           CMS.Gate.with_branch_check(
             user,
             :publish,
             community,
             article,
             branch_id,
             fn canonical -> Doc.publish(canonical, branch_id, author, opts) end
           ),
         {:ok, result} <- Effects.run(result) do
      {:ok, result}
    end
  end

  defp branch_community(branch_id, opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community -> {:ok, community}
      _ ->
        with %DocBranch{community_id: community_id} <- Repo.get(DocBranch, branch_id),
             %Community{} = community <- Repo.get(Community, community_id) do
          {:ok, community}
        else
          _ -> {:error, :article_binding_not_found}
        end
    end
  end
end
