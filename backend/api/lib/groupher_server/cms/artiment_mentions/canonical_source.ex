defmodule GroupherServer.CMS.ArtimentMentions.CanonicalSource do
  @moduledoc """
  Loads the selected public BodyBag before a Mention fact replacement.

      source locator -> current public head -> canonical BodyBag -> Store sync
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.Store

  alias CMS.Model.{
    Article,
    ArticleBodySnapshot,
    ArticlePublic,
    ArticleRevision,
    Comment,
    DocBranch,
    DocBranchVersion,
    DocPublic,
    TicketState
  }

  def sync_current(%{type: :comment, comment_id: id}, opts) when is_integer(id) do
    case Repo.get(Comment, id) do
      nil -> {:ok, :source_gone}
      comment -> Store.sync_comment_public(comment, opts)
    end
  end

  def sync_current(%{type: thread, article_id: id} = locator, opts)
      when thread in [:post, :blog, :changelog, :ticket, :doc] and is_binary(id) do
    with %Article{thread: ^thread} = article <- Repo.get(Article, id),
         {:ok, :pass} <- public_source_type(article),
         {:ok, source} <- current_article_source(article, Map.get(locator, :branch_id)) do
      Store.sync_public(source, opts)
    else
      nil -> {:ok, :source_gone}
      {:error, _} = error -> error
      _ -> {:error, :invalid_mention_source}
    end
  end

  def sync_current(_, _), do: {:error, :invalid_mention_source}

  defp current_article_source(%Article{thread: :doc} = article, branch_id)
       when is_integer(branch_id) do
    with %DocBranch{type: :main} <- Repo.get(DocBranch, branch_id),
         %DocPublic{} = public <-
           Repo.get_by(DocPublic, article_id: article.id, branch_id: branch_id),
         %DocBranchVersion{} = version <- Repo.get(DocBranchVersion, public.branch_version_id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, version.revision_id),
         %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, revision.body_snapshot_id) do
      {:ok,
       %{
         article_id: article.id,
         thread: :doc,
         branch_id: branch_id,
         body: body,
         author: Repo.preload(article, author: :user).author,
         branch_version_id: public.branch_version_id,
         publication_version: public.publication_version,
         updated_at: article.updated_at
       }}
    else
      _ -> {:error, :source_publication_missing}
    end
  end

  defp current_article_source(%Article{} = article, nil) do
    with %ArticlePublic{} = public <- Repo.get(ArticlePublic, article.id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id),
         %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, revision.body_snapshot_id) do
      {:ok,
       %{
         article_id: article.id,
         thread: article.thread,
         body: body,
         author: Repo.preload(article, author: :user).author,
         revision_id: public.revision_id,
         publication_version: public.publication_version,
         updated_at: article.updated_at
       }}
    else
      _ -> {:error, :source_publication_missing}
    end
  end

  defp current_article_source(_, _), do: {:error, :invalid_mention_branch}

  defp public_source_type(%Article{thread: :ticket, id: id}) do
    case Repo.get(TicketState, id) do
      %TicketState{type: :user} -> {:ok, :pass}
      _ -> {:error, :invalid_mention_source}
    end
  end

  defp public_source_type(_), do: {:ok, :pass}
end
