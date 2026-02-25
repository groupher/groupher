defmodule GroupherServer.CMS.Articles.Lifecycle do
  @moduledoc """
  Article lifecycle helpers.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher
  import Helper.ErrorCode

  import Helper.Utils,
    only: [
      done: 1,
      get_config: 2
    ]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias CMS.{Articles, Communities, FrontDesk}
  alias Ecto.Multi
  alias Helper.Types, as: T
  alias Helper.{ORM, Transaction}

  @active_period get_config(:article, :active_period_days)
  @archive_threshold get_config(:article, :archive_threshold)
  @remove_article_hint "The content does not comply with the community norms"

  @spec mark_delete(term()) :: T.domain_res(term())
  def mark_delete(article) do
    {:ok, thread} = FrontDesk.thread_of(article)

    Transaction.locking(article, fn article ->
      case article.is_archived do
        false ->
          Multi.new()
          |> Multi.run(:update_article, fn _, _ ->
            ORM.update(article, %{mark_delete: true})
          end)
          |> Multi.run(:update_community_article_count, fn _, _ ->
            Communities.update_count_field(article.communities, thread)
          end)
          |> Repo.transaction()
          |> result()

        true ->
          raise_error(:archived, "article is archived, can not be edit or delete")
      end
    end)
  end

  @spec undo_mark_delete(term()) :: T.domain_res(term())
  def undo_mark_delete(article) do
    {:ok, thread} = FrontDesk.thread_of(article)

    Transaction.locking(article, fn article ->
      Multi.new()
      |> Multi.run(:update_article, fn _, _ ->
        ORM.update(article, %{mark_delete: false})
      end)
      |> Multi.run(:update_community_article_count, fn _, _ ->
        Communities.update_count_field(article.communities, thread)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @spec batch_mark_delete(String.t(), atom(), [T.id()]) :: T.domain_res(term())
  def batch_mark_delete(community, thread, inner_id_list) do
    do_batch_mark_delete(community, thread, inner_id_list, true)
  end

  @spec batch_undo_mark_delete(String.t(), atom(), [T.id()]) :: T.domain_res(term())
  def batch_undo_mark_delete(community, thread, inner_id_list) do
    do_batch_mark_delete(community, thread, inner_id_list, false)
  end

  @spec delete(term()) :: T.domain_res(term())
  def delete(article) do
    delete(article, @remove_article_hint)
  end

  @spec delete(term(), String.t()) :: T.domain_res(term())
  def delete(article, _reason) do
    article = Repo.preload(article, [:communities, [author: :user]])
    {:ok, thread} = FrontDesk.thread_of(article)

    Multi.new()
    |> Multi.run(:delete_article, fn _, _ ->
      article |> ORM.delete()
    end)
    |> Multi.run(:update_community_article_count, fn _, _ ->
      Communities.update_count_field(article.communities, thread)
    end)
    |> Multi.run(:update_user_published_meta, fn _, _ ->
      Accounts.Publishes.update_published_states(article.author.user, thread)
    end)
    |> Multi.run(:delete_document, fn _, _ ->
      Articles.Document.remove(thread, article.id)
      {:ok, :pass}
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec archive(atom()) :: T.domain_res(term())
  def archive(thread) do
    with {:ok, info} <- match(thread) do
      now = Timex.now()
      threshold = @archive_threshold[thread] || @archive_threshold[:default]
      archive_threshold = Timex.shift(now, threshold)

      info.model
      |> where([article], article.inserted_at < ^archive_threshold)
      |> Repo.update_all(set: [is_archived: true, archived_at: now])
      |> done()
    end
  end

  @spec sink(term()) :: T.domain_res(term())
  def sink(article) do
    %{inserted_at: inserted_at} = article

    case ORM.update_meta(article, %{
           is_sunk: true,
           last_active_at: inserted_at
         }) do
      {:ok, article} ->
        ORM.update(article, %{active_at: inserted_at})

      {:error, reason} ->
        {:error, reason}
    end
  end

  @spec undo_sink(term()) :: T.domain_res(term())
  def undo_sink(article) do
    {:ok, thread} = FrontDesk.thread_of(article)

    with true <- in_active_period?(thread, article),
         {:ok, article} <- ORM.update_meta(article, %{is_sunk: false}) do
      ORM.update(article, %{active_at: article.meta.last_active_at})
    else
      false -> raise_error(:undo_sink_old_article, "can not undo sink old article")
    end
  end

  defp do_batch_mark_delete(community, thread, inner_id_list, delete_flag) do
    with {:ok, info} <- match(thread) do
      batch_query =
        info.model
        |> where([article], article.community_slug == ^community)
        |> where([article], article.inner_id in ^inner_id_list)

      Multi.new()
      |> Multi.run(:update_articles, fn _, _ ->
        batch_query
        |> Repo.update_all(set: [mark_delete: delete_flag])
        |> done
      end)
      |> Multi.run(:update_community_article_count, fn _, _ ->
        communities =
          from(a in batch_query, preload: :communities)
          |> Repo.all()
          |> Enum.map(& &1.communities)
          |> Enum.at(0)

        case communities do
          nil -> {:ok, :pass}
          _ -> Communities.update_count_field(communities, thread)
        end
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp in_active_period?(thread, article) do
    active_period_days = @active_period[thread] || @active_period[:default]

    inserted_at = article.inserted_at
    active_threshold = Timex.shift(Timex.now(), days: -active_period_days)

    :gt == DateTime.compare(inserted_at, active_threshold)
  end

  defp result({:ok, %{update_articles: _result}}), do: {:ok, %{done: true}}
  defp result({:ok, %{delete_article: result}}), do: {:ok, result}
  defp result({:ok, %{update_article: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}
end
