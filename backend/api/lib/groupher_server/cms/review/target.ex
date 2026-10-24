defmodule GroupherServer.CMS.Review.Target do
  @moduledoc """
  Locks the canonical target and its Lifecycle before ReviewBot locks a Check.

      ReviewBot target key
        -> parent Article lock
        -> resource Lifecycle lock
        -> Check lock
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    Comment,
    CommentLifecycle,
    DocLifecycle
  }

  @doc """
  Loads and locks one canonical review target in the caller-owned transaction.

  ## Examples

      CMS.load_review_target_for_update("comment:42", "community:7")
      #=> {:ok, %{kind: :comment, target: comment, lifecycle: lifecycle}} | {:error, reason}
  """
  @spec load_for_update(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def load_for_update(target_key, scope_key)
      when is_binary(target_key) and is_binary(scope_key) do
    with true <- Repo.in_transaction?(),
         {:ok, target} <- parse_target(target_key),
         {:ok, locked} <- lock_target(target, scope_key) do
      {:ok, locked}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def load_for_update(_target_key, _scope_key) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp parse_target("article:" <> id) do
    case Ecto.UUID.cast(id) do
      {:ok, id} -> {:ok, {:article, id}}
      :error -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp parse_target("comment:" <> id) do
    case Integer.parse(id) do
      {id, ""} when id > 0 -> {:ok, {:comment, id}}
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp parse_target("doc:" <> rest) do
    case String.split(rest, ":", parts: 2) do
      [article_id, branch_id] ->
        with {:ok, article_id} <- Ecto.UUID.cast(article_id),
             {branch_id, ""} when branch_id > 0 <- Integer.parse(branch_id) do
          {:ok, {:doc, article_id, branch_id}}
        else
          _ -> {:error, CMS.ErrorCat.invalid_review_block()}
        end

      _ ->
        {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp parse_target(_target_key), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp lock_target({:article, article_id}, scope_key) do
    with {:ok, article} <- lock_article(article_id),
         {:ok, :pass} <- lock_article_scope(article, scope_key),
         %ArticleLifecycle{} = lifecycle <- lock_article_lifecycle(article_id) do
      {:ok,
       %{
         kind: :article,
         target: article,
         lifecycle: lifecycle,
         target_key: "article:#{article.id}",
         scope_key: scope_key,
         case_attrs: %{article_id: article.id}
       }}
    else
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
      {:error, _reason} = error -> error
    end
  end

  defp lock_target({:comment, comment_id}, scope_key) do
    with %Comment{} = snapshot <- Repo.get(Comment, comment_id),
         {:ok, article} <- lock_article(snapshot.article_id),
         %Comment{} = comment <- lock_comment(comment_id),
         %CommentLifecycle{} = lifecycle <- lock_comment_lifecycle(comment_id),
         {:ok, :pass} <- lock_comment_scope(comment, scope_key) do
      {:ok,
       %{
         kind: :comment,
         target: comment,
         parent: article,
         lifecycle: lifecycle,
         target_key: "comment:#{comment.id}",
         scope_key: scope_key,
         case_attrs: %{comment_id: comment.id}
       }}
    else
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
      {:error, _reason} = error -> error
    end
  end

  defp lock_target({:doc, article_id, branch_id}, "platform") do
    with {:ok, article} <- lock_article(article_id),
         %DocLifecycle{} = lifecycle <- lock_doc_lifecycle(article_id, branch_id) do
      {:ok,
       %{
         kind: :doc,
         target: article,
         lifecycle: lifecycle,
         target_key: "doc:#{article.id}:#{branch_id}",
         scope_key: "platform",
         case_attrs: %{article_id: article.id, branch_id: branch_id}
       }}
    else
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
      {:error, _reason} = error -> error
    end
  end

  defp lock_target({:doc, _article_id, _branch_id}, _scope_key) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp lock_article(article_id) do
    case Repo.one(from(article in Article, where: article.id == ^article_id, lock: "FOR UPDATE")) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  defp lock_article_lifecycle(article_id) do
    Repo.one(
      from(lifecycle in ArticleLifecycle,
        where: lifecycle.article_id == ^article_id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp lock_comment(comment_id) do
    Repo.one(from(comment in Comment, where: comment.id == ^comment_id, lock: "FOR UPDATE"))
  end

  defp lock_comment_lifecycle(comment_id) do
    Repo.one(
      from(lifecycle in CommentLifecycle,
        where: lifecycle.comment_id == ^comment_id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp lock_doc_lifecycle(article_id, branch_id) do
    Repo.one(
      from(lifecycle in DocLifecycle,
        where: lifecycle.article_id == ^article_id and lifecycle.branch_id == ^branch_id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp lock_article_scope(_article, "platform"), do: {:ok, :pass}

  defp lock_article_scope(%Article{id: article_id}, "community:" <> community_id) do
    with {community_id, ""} <- Integer.parse(community_id),
         %ArticleBinding{} <-
           Repo.one(
             from(binding in ArticleBinding,
               where: binding.article_id == ^article_id and binding.community_id == ^community_id,
               lock: "FOR UPDATE"
             )
           ) do
      {:ok, :pass}
    else
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp lock_article_scope(_article, _scope_key) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp lock_comment_scope(_comment, "platform"), do: {:ok, :pass}

  defp lock_comment_scope(%Comment{community_id: community_id}, scope_key) do
    if scope_key == "community:#{community_id}" do
      {:ok, :pass}
    else
      {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end
end
