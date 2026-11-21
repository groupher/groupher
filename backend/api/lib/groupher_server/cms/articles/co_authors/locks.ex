defmodule GroupherServer.CMS.Articles.CoAuthors.Locks do
  @moduledoc """
  Acquires the Article co-author aggregate lock order.

      Article -> Users -> Authors -> current members -> requests
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorRequest, Author}

  @doc "Locks one Article aggregate and all explicitly involved users and rows."
  def lock(article_id, user_ids, request_ids \\ [])

  def lock(article_id, user_ids, request_ids)
      when is_binary(article_id) and is_list(user_ids) and is_list(request_ids) do
    if Repo.in_transaction?() do
      lock_in_transaction(article_id, user_ids, request_ids)
    else
      {:error, :transaction_required}
    end
  end

  def lock(_, _, _), do: {:error, :invalid_or_missing_lock_target}

  defp lock_in_transaction(article_id, user_ids, request_ids) do
    ids = Enum.sort(Enum.uniq(user_ids))
    request_ids = Enum.sort(Enum.uniq(request_ids))

    with true <- Enum.all?(ids, &(is_integer(&1) and &1 > 0)),
         true <- Enum.all?(request_ids, &is_binary/1),
         %Article{} = article <-
           Repo.one(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE")),
         pending <- pending_for_users(article_id, ids),
         extra_user_ids <- Enum.flat_map(pending, &[&1.subject_user_id, &1.created_by_id]),
         locked_user_ids <- Enum.sort(Enum.uniq(ids ++ extra_user_ids)),
         users <- lock_users(locked_user_ids),
         true <- Enum.map(users, & &1.id) == locked_user_ids,
         authors <- lock_authors(locked_user_ids),
         author_ids <- Enum.map(authors, & &1.id),
         members <- lock_members(article_id, author_ids),
         all_request_ids <- Enum.sort(Enum.uniq(request_ids ++ Enum.map(pending, & &1.id))),
         requests <- lock_requests(article_id, all_request_ids),
         true <- Enum.map(requests, & &1.id) == all_request_ids do
      {:ok,
       %{
         article: article,
         users: users,
         authors: authors,
         members: members,
         requests: requests
       }}
    else
      false -> {:error, :invalid_or_missing_lock_target}
      nil -> {:error, :article_not_found}
      {:error, _} = error -> error
    end
  end

  defp pending_for_users(article_id, user_ids) do
    Repo.all(
      from(request in ArticleCoAuthorRequest,
        where:
          request.article_id == ^article_id and request.status == :pending and
            request.subject_user_id in ^user_ids,
        order_by: request.id
      )
    )
  end

  defp lock_users([]), do: []

  defp lock_users(ids) do
    Repo.all(from(user in User, where: user.id in ^ids, order_by: user.id, lock: "FOR UPDATE"))
  end

  defp lock_authors([]), do: []

  defp lock_authors(ids) do
    Repo.all(
      from(author in Author,
        where: author.user_id in ^ids,
        order_by: author.user_id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp lock_members(_article_id, []), do: []

  defp lock_members(article_id, author_ids) do
    Repo.all(
      from(member in ArticleCoAuthor,
        where: member.article_id == ^article_id and member.author_id in ^author_ids,
        order_by: [member.article_id, member.author_id],
        lock: "FOR UPDATE"
      )
    )
  end

  defp lock_requests(_article_id, []), do: []

  defp lock_requests(article_id, ids) do
    Repo.all(
      from(request in ArticleCoAuthorRequest,
        where: request.article_id == ^article_id and request.id in ^ids,
        order_by: request.id,
        lock: "FOR UPDATE"
      )
    )
  end
end
