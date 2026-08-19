defmodule GroupherServer.CMS.Articles.Reader do
  @moduledoc """
  Reader helpers for articles.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Reader
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.{Interactions}
  alias CMS.Articles.InteractionResponse
  alias CMS.Gate.Scope
  alias CMS.Articles.ErrorCat
  alias CMS.Communities.Enable
  alias CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias CMS.Gate.Context.Scope.Doc, as: DocScope
  alias CMS.Model.{Community, DocBranch, PinnedArticle}
  alias Helper.{Multi, Constant, Datetime, ORM, T}

  require CMS.Const

  @active_period GroupherServer.CMS.Artiment.Config.active_period_days()
  @threads GroupherServer.CMS.Artiment.Config.threads()
  @audit_legal Constant.CMS.pending(:legal)
  @audit_illegal Constant.CMS.pending(:illegal)
  @audit_failed Constant.CMS.pending(:audit_failed)

  @doc """
  Reads one article by community, thread, and inner id for an anonymous viewer.

  Records the view, loads the article document, marks the pinned flag, and
  returns the article with viewer interaction states.

  ## Examples

      CMS.Articles.Reader.read(community, :post, 1001)

  """
  @spec read(Community.t(), T.thread(), T.id()) :: T.domain_res(T.article())
  def read(%Community{} = community, thread, inner_id) when thread in @threads do
    with {:ok, _thread} <- Enable.thread?(community.slug, thread),
         {:ok, article} <- if_article_legal(community, thread, inner_id) do
      with {:ok, article} <- do_read_article(article, community, thread, nil, nil) do
        InteractionResponse.one(article, nil)
      end
    end
  end

  @spec read(Community.t(), T.thread(), T.id(), User.t()) :: T.domain_res(T.article())
  def read(%Community{} = community, thread, inner_id, %User{} = user)
      when thread in @threads,
      do: read(community, thread, inner_id, user, nil)

  @spec read(Community.t(), T.thread(), T.id(), User.t(), Ecto.UUID.t() | nil) ::
          T.domain_res(T.article())
  def read(%Community{} = community, thread, inner_id, %User{} = user, event_id)
      when thread in @threads do
    with {:ok, _thread} <- Enable.thread?(community.slug, thread),
         {:ok, article} <- if_article_legal(community, thread, inner_id, user) do
      Multi.new()
      |> Multi.run(:normal_read, fn _, _ ->
        do_read_article(article, community, thread, user, event_id)
      end)
      |> Multi.run(:set_viewer_has_states, fn _, %{normal_read: article} ->
        InteractionResponse.one(article, user)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp do_read_article(article, %Community{} = community, thread, user, event_id) do
    Multi.new()
    |> Multi.run(:record_view, fn _, _ ->
      Interactions.record_view(article, user, event_id)
    end)
    |> Multi.run(:load_html, fn _, _ ->
      article |> Repo.preload(:document) |> done()
    end)
    |> Multi.run(:add_pinned_flag, fn _, %{load_html: article} ->
      pin_query = Map.merge(%{community_id: community.id}, %{"#{thread}_id": article.id})

      case ORM.find_by(PinnedArticle, pin_query) do
        {:ok, _} ->
          {:ok, %{article | is_pinned: true}}

        {:error, _} ->
          {:ok, article}
      end
    end)
    |> Multi.run(:update_article_meta, fn _, %{add_pinned_flag: article} ->
      ORM.update_meta(article, %{can_undo_sink: in_active_period?(thread, article)})
    end)
    |> Repo.transaction()
    |> result()
  end

  defp if_article_legal(%Community{id: community_id}, thread, inner_id, user)
       when thread in @threads do
    with {:ok, info} <- match(thread),
         {:ok, article} <-
           find_active(info.model, community_id, thread, inner_id, [:author], user) do
      if_article_legal(article, user)
    end
  end

  defp if_article_legal(%Community{id: community_id}, thread, inner_id)
       when thread in @threads do
    with {:ok, info} <- match(thread),
         {:ok, article} <- find_active(info.model, community_id, thread, inner_id, [], nil) do
      if_article_legal(article)
    end
  end

  defp find_active(model, community_id, thread, inner_id, preloads, actor) do
    with {:ok, context} <- public_scope_context(community_id, thread),
         %Ecto.Query{} = query <- Scope.scope(model, actor, :read, context) do
      query
      |> where([article], article.community_id == ^community_id)
      |> where([article], article.inner_id == ^inner_id)
      |> preload(^preloads)
      |> Repo.one()
      |> case do
        nil -> diagnose_moderation(model, community_id, thread, inner_id)
        article -> {:ok, article}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp public_scope_context(community_id, :doc) do
    case Repo.get_by(DocBranch,
           community_id: community_id,
           type: CMS.Const.doc_branch_type(:main)
         ) do
      %DocBranch{id: branch_id} ->
        {:ok, DocScope.public_branch(branch_id)}

      nil ->
        {:error, CMS.Articles.ErrorCat.not_exist("Doc main branch")}
    end
  end

  defp public_scope_context(_community_id, thread),
    do: {:ok, ArticleScope.public(thread)}

  defp diagnose_moderation(model, community_id, thread, inner_id) do
    model
    |> Scope.Article.moderation_diagnostic_scope(thread)
    |> where([article], article.community_id == ^community_id and article.inner_id == ^inner_id)
    |> Repo.exists?()
    |> case do
      true -> pending("this article is under audition")
      false -> {:error, CMS.Articles.ErrorCat.not_exist(model)}
    end
  end

  defp if_article_legal(%{pending: @audit_legal} = article, _), do: {:ok, article}
  defp if_article_legal(%{pending: @audit_failed} = article, _), do: {:ok, article}

  defp if_article_legal(%{pending: @audit_illegal} = article, %User{id: user_id}) do
    case article.author.user_id == user_id do
      true -> {:ok, article}
      false -> pending("this article is under audition")
    end
  end

  defp if_article_legal(%{pending: @audit_illegal}) do
    pending("this article is under audition")
  end

  defp if_article_legal(article), do: {:ok, article}

  defp in_active_period?(thread, article) do
    active_period_days = @active_period[thread] || @active_period[:default]

    inserted_at = article.inserted_at
    active_threshold = Datetime.now() |> Datetime.shift(days: -active_period_days)

    :gt == DateTime.compare(inserted_at, active_threshold)
  end

  # Make transaction return shape explicit and stable.
  defp result({:ok, %{set_viewer_has_states: {:ok, article}}}), do: {:ok, article}
  defp result({:ok, %{set_viewer_has_states: article}}), do: {:ok, article}
  defp result({:ok, %{update_article_meta: article}}), do: {:ok, article}
  defp result({:error, _step, reason, _changes}), do: {:error, reason}

  defp pending(details), do: {:error, ErrorCat.pending(details)}
end
