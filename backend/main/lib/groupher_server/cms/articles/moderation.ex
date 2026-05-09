defmodule GroupherServer.CMS.Articles.Moderation do
  @moduledoc """
  Article moderation helpers.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher

  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.{CMS, Repo}

  alias CMS.Communities.TagStats
  alias CMS.FrontDesk
  alias GroupherServer.FrontDesk, as: UserFrontDesk
  alias Helper.{Multi, Constant, ORM, QueryBuilder, T}

  @audit_legal Constant.CMS.pending(:legal)
  @audit_illegal Constant.CMS.pending(:illegal)
  @audit_failed Constant.CMS.pending(:audit_failed)

  @spec paged_audit_failed(atom(), map()) :: T.domain_res(term())
  def paged_audit_failed(thread, filter) do
    %{page: page, size: size} = filter
    flags = %{mark_delete: false, pending: :audit_failed}

    with {:ok, info} <- match(thread) do
      info.model
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
    |> Multi.run(:update_tag_stats, fn _, _ ->
      update_tag_stats(article, :dec)
    end)
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(article, %{pending: @audit_illegal})
    end)
    |> Multi.run(:update_article_meta, fn _, %{update_pending_state: article} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])
      ORM.update_meta(article, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      article = Repo.preload(article, :author)
      illegal_articles = Map.get(audit_state, :illegal_articles, [])

      with {:ok, user} <- UserFrontDesk.user(article.author.user_id) do
        illegal_articles = user.meta.illegal_articles ++ illegal_articles

        ORM.update_meta(user, %{has_illegal_articles: true, illegal_articles: illegal_articles})
      end
    end)
    |> Repo.transaction()
    |> result()
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
      if article.pending == @audit_illegal do
        update_tag_stats(updated_article, :inc)
      else
        {:ok, :pass}
      end
    end)
    |> Multi.run(:update_article_meta, fn _, %{update_pending_state: article} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])

      ORM.update_meta(article, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      article = Repo.preload(article, :author)
      illegal_articles = Map.get(audit_state, :illegal_articles, [])

      with {:ok, user} <- UserFrontDesk.user(article.author.user_id) do
        illegal_articles = user.meta.illegal_articles -- illegal_articles
        has_illegal_articles = not Enum.empty?(illegal_articles)

        ORM.update_meta(user, %{
          has_illegal_articles: has_illegal_articles,
          illegal_articles: illegal_articles
        })
      end
    end)
    |> Repo.transaction()
    |> result()
  end

  defp result({:ok, %{update_article_meta: result}}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}

  defp update_tag_stats(article, action) do
    article = Repo.preload(article, :community_tags)

    Enum.reduce_while(article.community_tags, {:ok, :pass}, fn tag, {:ok, :pass} ->
      case apply(TagStats, action, [article, tag]) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        error -> {:halt, error}
      end
    end)
  end
end
