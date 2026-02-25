defmodule GroupherServer.CMS.Articles.Read do
  @moduledoc """
  Read helpers for articles.
  """

  import GroupherServer.CMS.Helper.Matcher
  import Helper.ErrorCode

  import Helper.Utils,
    only: [
      done: 1,
      get_config: 2
    ]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.{Community, PinnedArticle}

  alias Ecto.Multi
  alias Helper.{Constant, ORM, T}

  @active_period get_config(:article, :active_period_days)
  @article_threads get_config(:article, :threads)
  @audit_legal Constant.CMS.pending(:legal)
  @audit_illegal Constant.CMS.pending(:illegal)
  @audit_failed Constant.CMS.pending(:audit_failed)

  @spec read(String.t(), T.article_thread(), T.id()) :: T.domain_res(T.article())
  def read(community_slug, thread, inner_id) when thread in @article_threads do
    with {:ok, article} <- if_article_legal(community_slug, thread, inner_id) do
      do_read_article(article, community_slug, thread)
    end
  end

  @spec read(String.t(), T.article_thread(), T.id(), User.t()) :: T.domain_res(T.article())
  def read(community_slug, thread, inner_id, %User{id: user_id} = user)
      when thread in @article_threads do
    with {:ok, article} <- if_article_legal(community_slug, thread, inner_id, user) do
      Multi.new()
      |> Multi.run(:normal_read, fn _, _ ->
        do_read_article(article, community_slug, thread)
      end)
      |> Multi.run(:add_viewed_user, fn _, %{normal_read: article} ->
        update_viewed_user_list(article, user_id)
      end)
      |> Multi.run(:set_viewer_has_states, fn _, %{normal_read: article} ->
        article = Repo.preload(article, :community)

        article =
          %{
            article
            | viewer_has_viewed: true,
              viewer_has_collected: user_id in article.meta.collected_user_ids,
              viewer_has_upvoted: user_id in article.meta.upvoted_user_ids,
              viewer_has_reported: user_id in article.meta.reported_user_ids
          }

        {:ok, article}
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp do_read_article(article, community_slug, thread) do
    Multi.new()
    |> Multi.run(:inc_views, fn _, _ ->
      ORM.inc(article, :views)
    end)
    |> Multi.run(:load_html, fn _, %{inc_views: article} ->
      article |> Repo.preload(:document) |> done()
    end)
    |> Multi.run(:add_pinned_flag, fn _, %{load_html: article} ->
      with {:ok, community} <- ORM.find_by(Community, %{slug: community_slug}) do
        pin_query = Map.merge(%{community_id: community.id}, %{"#{thread}_id": article.id})

        case ORM.find_by(PinnedArticle, pin_query) do
          {:ok, _} ->
            {:ok, %{article | is_pinned: true}}

          {:error, _} ->
            {:ok, article}
        end
      end
    end)
    |> Multi.run(:update_article_meta, fn _, %{add_pinned_flag: article} ->
      ORM.update_meta(article, %{can_undo_sink: in_active_period?(thread, article)})
    end)
    |> Repo.transaction()
    |> result()
  end

  defp if_article_legal(community_slug, thread, inner_id, user)
       when thread in @article_threads do
    clauses = %{community_slug: community_slug, inner_id: inner_id}

    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find_by(info.model, clauses, preload: :author) do
      if_article_legal(article, user)
    end
  end

  defp if_article_legal(community_slug, thread, inner_id)
       when thread in @article_threads do
    clauses = %{community_slug: community_slug, inner_id: inner_id}

    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find_by(info.model, clauses) do
      if_article_legal(article)
    end
  end

  defp if_article_legal(%{pending: @audit_legal} = article, _), do: {:ok, article}
  defp if_article_legal(%{pending: @audit_failed} = article, _), do: {:ok, article}

  defp if_article_legal(%{pending: @audit_illegal} = article, %User{id: user_id}) do
    case article.author.user_id == user_id do
      true -> {:ok, article}
      false -> raise_error(:pending, "this article is under audition")
    end
  end

  defp if_article_legal(%{pending: @audit_illegal}) do
    raise_error(:pending, "this article is under audition")
  end

  defp if_article_legal(article), do: {:ok, article}

  defp update_viewed_user_list(%{meta: meta} = article, user_id) do
    user_not_viewed = not Enum.member?(meta.viewed_user_ids, user_id)

    case Enum.empty?(meta.viewed_user_ids) or user_not_viewed do
      true ->
        new_ids = Enum.uniq([user_id] ++ meta.viewed_user_ids)
        meta = Map.merge(meta, %{viewed_user_ids: new_ids})
        ORM.update_meta(article, meta)

      false ->
        {:ok, :pass}
    end
  end

  defp in_active_period?(thread, article) do
    active_period_days = @active_period[thread] || @active_period[:default]

    inserted_at = article.inserted_at
    active_threshold = Timex.shift(Timex.now(), days: -active_period_days)

    :gt == DateTime.compare(inserted_at, active_threshold)
  end

  # Make transaction return shape explicit and stable.
  defp result({:ok, %{set_viewer_has_states: {:ok, article}}}), do: {:ok, article}
  defp result({:ok, %{set_viewer_has_states: article}}), do: {:ok, article}
  defp result({:ok, %{update_article_meta: article}}), do: {:ok, article}
  defp result({:error, _step, reason, _changes}), do: {:error, reason}
end
