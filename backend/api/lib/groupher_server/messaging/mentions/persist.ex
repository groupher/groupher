defmodule GroupherServer.Messaging.Mentions.Persist do
  @moduledoc """
  Owns mention-row persistence primitives.

  The module normalizes and idempotently inserts delivery rows but never opens
  a transaction. The surrounding SendMention command owns atomicity and mailbox
  projection sync. A target/content token/recipient identity makes event replay
  safe and leaves the existing `read` state untouched.

      article/comment + mentions
          -> resolve target and content token
          -> insert current recipients once
          -> return affected recipients
  """

  import Ecto.Query, warn: false
  alias GroupherServer.{Accounts, CMS, Messaging, Repo}

  alias CMS.Model.{
    Article,
    ArticlePublic,
    Comment,
    CommentBody,
    DocPublic
  }

  alias Accounts.Model.User
  alias Messaging.Model.Mention

  @doc """
  Persists one delivery per target revision and recipient.

  ## Examples

      Messaging.Mentions.Persist.replace(comment, mentions, user)
  """
  @spec replace(struct(), list(), User.t()) :: {:ok, list()} | {:error, term()}
  def replace(content, mentions, %User{} = from_user) do
    with {:ok, target_key, content_token} <- delivery_identity(content),
         {:ok, mentions} <- normalize_mentions(mentions),
         mentions <- reject_self_mentions(content, mentions, from_user),
         mentions <-
           Enum.map(
             mentions,
             &Map.merge(&1, %{target_key: target_key, content_token: content_token})
           ),
         {:ok, _inserted} <- insert_mentions(mentions) do
      {:ok, mentions}
    end
  end

  defp insert_mentions([]), do: {:ok, :pass}

  defp insert_mentions(mentions) do
    case Repo.insert_all(Mention, mentions, on_conflict: :nothing) do
      {_count, _rows} -> {:ok, :pass}
    end
  end

  defp reject_self_mentions(%Comment{}, mentions, _from_user), do: mentions

  defp reject_self_mentions(_content, mentions, %User{id: from_user_id}) do
    Enum.reject(mentions, &(&1.to_user_id == from_user_id))
  end

  defp normalize_mentions(mentions) do
    mentions
    |> Enum.reduce_while({:ok, []}, fn mention, {:ok, acc} ->
      case normalize_mention(mention) do
        {:ok, mention} -> {:cont, {:ok, [mention | acc]}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, mentions} -> {:ok, Enum.reverse(mentions)}
      error -> error
    end
  end

  defp normalize_mention(%{thread: thread} = mention) when is_atom(thread) do
    case GroupherServer.CMS.artiment_threads_to_atom(thread) do
      {:ok, thread} -> {:ok, %{mention | thread: thread}}
      {:error, _reason} -> {:error, "insert mentions error"}
    end
  end

  defp normalize_mention(%{thread: _thread}), do: {:error, "insert mentions error"}
  defp normalize_mention(mention), do: {:ok, mention}

  defp delivery_identity(%Comment{id: id} = comment) do
    with {:ok, token} <- comment_token(comment) do
      {:ok, "comment:#{id}", token}
    end
  end

  defp delivery_identity(%{comment_id: id} = comment) when is_integer(id) or is_binary(id) do
    with {:ok, token} <- comment_token(comment) do
      {:ok, "comment:#{id}", token}
    end
  end

  defp delivery_identity(%{article_id: id, thread: :doc, branch_id: branch_id} = article)
       when is_binary(id) and is_integer(branch_id) do
    with {:ok, token} <- article_token(article, id, :doc, branch_id) do
      {:ok, "doc:#{id}:#{branch_id}", token}
    end
  end

  defp delivery_identity(%Article{id: id, thread: :doc} = article) do
    with {:ok, branch_id} <- doc_branch_id(article, id),
         {:ok, token} <- article_token(article, id, :doc, branch_id) do
      {:ok, "doc:#{id}:#{branch_id}", token}
    end
  end

  defp delivery_identity(%Article{id: id, thread: thread} = article) do
    with {:ok, token} <- article_token(article, id, thread, nil) do
      {:ok, "article:#{id}", token}
    end
  end

  defp delivery_identity(%{article_id: id, thread: thread} = article)
       when is_binary(id) and thread != :doc do
    with {:ok, token} <- article_token(article, id, thread, nil) do
      {:ok, "article:#{id}", token}
    end
  end

  defp delivery_identity(%{article_id: id, thread: :doc} = article) when is_binary(id) do
    with {:ok, branch_id} <- doc_branch_id(article, id),
         {:ok, token} <- article_token(article, id, :doc, branch_id) do
      {:ok, "doc:#{id}:#{branch_id}", token}
    end
  end

  defp delivery_identity(_content), do: {:error, :mention_target_invalid}

  defp article_token(%{revision_id: revision_id}, _article_id, _thread, _branch_id)
       when is_binary(revision_id) do
    {:ok, "revision:#{revision_id}"}
  end

  defp article_token(_content, article_id, :doc, branch_id) do
    case Repo.get_by(DocPublic, article_id: article_id, branch_id: branch_id) do
      %{revision_id: revision_id} when is_binary(revision_id) -> {:ok, "revision:#{revision_id}"}
      _ -> {:error, :mention_content_token_missing}
    end
  end

  defp article_token(_content, article_id, _thread, _branch_id) do
    case Repo.get(ArticlePublic, article_id) do
      %{revision_id: revision_id} when is_binary(revision_id) -> {:ok, "revision:#{revision_id}"}
      _ -> {:error, :mention_content_token_missing}
    end
  end

  defp comment_token(%{id: id}) when is_integer(id) do
    body_token =
      case Repo.get_by(CommentBody, comment_id: id) do
        %CommentBody{version: version} when is_integer(version) and version > 0 ->
          "body-version:#{version}"

        _ ->
          nil
      end

    case body_token do
      token when is_binary(token) -> {:ok, token}
      _ -> {:error, :mention_content_token_missing}
    end
  end

  defp comment_token(_comment), do: {:error, :mention_content_token_missing}

  defp doc_branch_id(_article, article_id) do
    case Repo.one(
           from(public in CMS.Model.DocPublic,
             where: public.article_id == ^article_id,
             select: public.branch_id
           )
         ) do
      branch_id when is_integer(branch_id) -> {:ok, branch_id}
      _ -> {:error, :mention_content_token_missing}
    end
  end
end
