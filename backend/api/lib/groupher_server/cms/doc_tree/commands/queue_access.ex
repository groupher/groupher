defmodule GroupherServer.CMS.DocTree.Commands.QueueAccess do
  @moduledoc """
  Authorizes a Doc's editable binding for Queue commands.

      Docs Queue command -> QueueAccess -> Gate article binding decision
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Article

  @doc "Checks edit access to the Doc in the specified community."
  def authorize(community, article_id, actor) do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         %Article{thread: :doc} = article <- Repo.get(Article, article_id) do
      CMS.Gate.Access.Check.with_authorized_article_binding(
        actor,
        :edit,
        {community, article},
        fn _ -> {:ok, :pass} end
      )
    else
      _ -> {:error, :invalid_doc_identity}
    end
  end

  @doc "Rechecks current Doc edit access through Gate after a Receipt commits."
  def authorize_after_commit(community, article_id, actor) do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         %Article{thread: :doc} = article <- Repo.get(Article, article_id) do
      CMS.Gate.with_community_check(actor, :edit, community, article, fn _ -> {:ok, :pass} end)
    else
      _ -> {:error, :invalid_doc_identity}
    end
  end
end
