defmodule GroupherServer.CMS.Review.Target do
  @moduledoc """
  Locks the CMS target and its Lifecycle before a review result or report is applied.

      CMS target key
        -> parent Article lock
        -> resource Lifecycle lock
        -> CMS review request or report write
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic,
    Comment,
    CommentBody,
    CommentLifecycle,
    DocLifecycle,
    DocPublic
  }

  @doc """
  Loads and locks one canonical review target in the caller-owned transaction.

  ## Examples

      CMS.Review.load_for_update("comment:42", "community:7")
      #=> {:ok, %{type: :comment, target: comment, lifecycle: lifecycle}} | {:error, reason}
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

  @doc "Checks that a report still refers to the target's current public content."
  def validate_report_target_in_transaction(%{
        owner: :cms,
        target_type: type,
        target_id: id,
        community_id: community_id,
        observed_version: version
      })
      when type in [:article, :comment, :doc] and is_binary(id) and is_integer(version) and
             version > 0 do
    scope_key = if is_nil(community_id), do: "platform", else: "community:#{community_id}"

    with {:ok, context} <- load_for_update("#{type}:#{id}", scope_key),
         true <- current_public_version(context) == version do
      {:ok, :pass}
    else
      false -> {:error, CMS.ErrorCat.review_content_changed()}
      {:error, _reason} = error -> error
    end
  end

  def validate_report_target_in_transaction(_target) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp current_public_version(%{
         type: :article,
         target: article,
         lifecycle: %{state: state}
       })
       when state in [:published, :archived] do
    case Repo.get(ArticlePublic, article.id) do
      %ArticlePublic{publication_version: version} -> version
      nil -> nil
    end
  end

  defp current_public_version(%{
         type: :comment,
         target: comment,
         lifecycle: %{state: :visible}
       }) do
    case Repo.get_by(CommentBody, comment_id: comment.id) do
      %CommentBody{version: version} -> version
      nil -> nil
    end
  end

  defp current_public_version(%{
         type: :doc,
         target: article,
         lifecycle: %{state: state} = lifecycle
       })
       when state in [:published, :archived] do
    case Repo.get_by(DocPublic, article_id: article.id, branch_id: lifecycle.branch_id) do
      %DocPublic{publication_version: version} -> version
      nil -> nil
    end
  end

  defp current_public_version(_context), do: nil

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
         type: :article,
         target: article,
         lifecycle: lifecycle,
         target_key: "article:#{article.id}",
         scope_key: scope_key
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
         type: :comment,
         target: comment,
         parent: article,
         lifecycle: lifecycle,
         target_key: "comment:#{comment.id}",
         scope_key: scope_key
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
         type: :doc,
         target: article,
         lifecycle: lifecycle,
         target_key: "doc:#{article.id}:#{branch_id}",
         scope_key: "platform",
         branch_id: branch_id
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
