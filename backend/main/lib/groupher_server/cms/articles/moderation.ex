defmodule GroupherServer.CMS.Articles.Moderation do
  alias GroupherServer.CMS.QueryBuilder
  @moduledoc """
  Article moderation helpers.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Moderation
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher

  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.Repo

  alias GroupherServer.CMS.Articles.Trash
  alias GroupherServer.CMS.Communities.TagStats
  alias GroupherServer.CMS.FrontDesk
  alias GroupherServer.CMS.SearchArtiments.Indexer
  alias Helper.{Multi, ORM, T}

  @audit_legal GroupherServer.CMS.Artiment.Const.moderation_state(:legal)
  @audit_illegal GroupherServer.CMS.Artiment.Const.moderation_state(:illegal)
  @audit_failed GroupherServer.CMS.Artiment.Const.moderation_state(:audit_failed)

  @doc """
  Returns a paged list of audit-failed articles for one thread.

  ## Examples

      CMS.Articles.Moderation.paged_audit_failed(:post, %{page: 1, size: 20})

  """
  @spec paged_audit_failed(atom(), map()) :: T.domain_res(term())
  def paged_audit_failed(thread, filter) do
    %{page: page, size: size} = filter
    flags = %{pending: :audit_failed}

    with {:ok, info} <- match(thread) do
      info.model
      |> Trash.not_trashed_scope(thread)
      |> QueryBuilder.filter_pack(Map.merge(filter, flags))
      |> ORM.paginator(~m(page size)a)
      |> done()
    end
  end

  @spec set_audit_failed(term(), term()) :: T.domain_res(term())
  def set_audit_failed(article, _audit_state) do
    ORM.update(article, %{pending: @audit_failed})
  end

  @spec set_illegal(atom(), T.id(), map()) :: T.domain_res(term())
  def set_illegal(thread, id, audit_state) do
    with {:ok, info} <- match(thread),
         {:ok, article} <- FrontDesk.get(info.model, id) do
      set_illegal(article, audit_state)
    end
  end

  @spec set_illegal(term(), map()) :: T.domain_res(term())
  def set_illegal(article, audit_state) do
    article = Repo.preload(article, :community_tags)

    Multi.new()
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(article, %{pending: @audit_illegal})
    end)
    |> Multi.run(:update_tag_stats, fn _, %{update_pending_state: updated_article} ->
      update_tag_stats_on_visibility_change(article, updated_article)
    end)
    |> Multi.run(:update_article_meta, fn _, %{update_pending_state: article} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])
      ORM.update_meta(article, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      article = Repo.preload(article, author: :user)
      illegal_articles = Map.get(audit_state, :illegal_articles, [])

      with {:ok, user} <- FrontDesk.live_user(article.author.user.login) do
        illegal_articles = user.meta.illegal_articles ++ illegal_articles

        user
        |> ORM.update_meta(%{has_illegal_articles: true, illegal_articles: illegal_articles})
        |> revalidate_user(user.login)
      end
    end)
    |> Repo.transaction()
    |> result()
    |> sync_search(:delete)
  end

  @spec unset_illegal(atom(), T.id(), map()) :: T.domain_res(term())
  def unset_illegal(thread, id, audit_state) do
    with {:ok, info} <- match(thread),
         {:ok, article} <- FrontDesk.get(info.model, id) do
      unset_illegal(article, audit_state)
    end
  end

  @spec unset_illegal(term(), map()) :: T.domain_res(term())
  def unset_illegal(article, audit_state) do
    article = Repo.preload(article, :community_tags)

    Multi.new()
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(article, %{pending: @audit_legal})
    end)
    |> Multi.run(:update_tag_stats, fn _, %{update_pending_state: updated_article} ->
      update_tag_stats_on_visibility_change(article, updated_article)
    end)
    |> Multi.run(:update_article_meta, fn _, %{update_pending_state: article} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])

      ORM.update_meta(article, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      article = Repo.preload(article, author: :user)
      illegal_articles = Map.get(audit_state, :illegal_articles, [])

      with {:ok, user} <- FrontDesk.live_user(article.author.user.login) do
        illegal_articles = user.meta.illegal_articles -- illegal_articles
        has_illegal_articles = not Enum.empty?(illegal_articles)

        user
        |> ORM.update_meta(%{
          has_illegal_articles: has_illegal_articles,
          illegal_articles: illegal_articles
        })
        |> revalidate_user(user.login)
      end
    end)
    |> Repo.transaction()
    |> result()
    |> sync_search(:upsert)
  end

  defp result({:ok, %{update_article_meta: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}

  defp revalidate_user({:ok, _result} = response, login) do
    FrontDesk.revalidate_user(login)
    response
  end

  defp revalidate_user(response, _login), do: response

  defp update_tag_stats(article, action) do
    article = Repo.preload(article, :community_tags)

    Enum.reduce_while(article.community_tags, {:ok, :pass}, fn tag, {:ok, :pass} ->
      case apply(TagStats, action, [article, tag]) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        error -> {:halt, error}
      end
    end)
  end

  defp update_tag_stats_on_visibility_change(article, updated_article) do
    case {counted_in_tag_stats?(article), counted_in_tag_stats?(updated_article)} do
      {true, false} -> update_tag_stats(article, :dec)
      {false, true} -> update_tag_stats(updated_article, :inc)
      _ -> {:ok, :pass}
    end
  end

  defp sync_search({:ok, article} = result, :delete) do
    Indexer.enqueue_delete(article)
    result
  end

  defp sync_search({:ok, article} = result, :upsert) do
    Indexer.enqueue_upsert(article)
    result
  end

  defp sync_search(result, _action), do: result

  defp counted_in_tag_stats?(article) do
    not Trash.trashed_article?(article) and
      Map.get(article, :pending) != @audit_illegal
  end
end
