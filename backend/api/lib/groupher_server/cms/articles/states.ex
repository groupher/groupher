defmodule GroupherServer.CMS.Articles.States do
  @moduledoc """
  Article status and lifecycle helpers.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> States
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.ErrorCat
  alias CMS.{Articles.Lifecycle, Artiment.Const, Comments.Persist}

  alias CMS.Model.{
    Article,
    PostState
  }

  alias Helper.{Datetime, T}

  @active_period CMS.Artiment.Config.active_period_days()
  @archive_threshold CMS.Artiment.Config.archive_threshold()
  @article_cat Const.cat_values() |> Enum.into(%{}, &{&1, &1})

  @doc """
  Sets the category of a post and refreshes the question flag on its comments.

  ## Examples

      CMS.Articles.States.set_cat(post, :qa)

  """
  @spec set_cat(map(), term()) :: T.domain_res(term())
  def set_cat(%Article{id: article_id, thread: :post} = article, cat) do
    with %PostState{} = state <- Repo.get(PostState, article_id),
         {:ok, _state} <- state |> PostState.changeset(%{cat: cat}) |> Repo.update(),
         {:ok, _} <- Persist.batch_update_question_flag(article, cat == @article_cat.qa) do
      {:ok, article}
    else
      nil -> {:error, ErrorCat.article_not_found("article not found")}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec update_active_timestamp(atom(), term()) :: T.domain_res(term())
  def update_active_timestamp(thread, %{id: article_id} = article) when is_binary(article_id) do
    if in_active_period?(thread, article) do
      update_stable_article(article, %{active_at: DateTime.utc_now(:second)})
    else
      {:ok, :pass}
    end
  end

  @spec update_edit_status(term()) :: T.domain_res(term())
  def update_edit_status(%{id: article_id} = content) when is_binary(article_id) do
    update_stable_article(content, %{is_edited: true})
  end

  @spec archive(atom()) :: T.domain_res(term())
  def archive(thread) do
    with {:ok, _info} <- match(thread) do
      now = Datetime.now(:second)
      threshold = @archive_threshold[thread] || @archive_threshold[:default]
      archive_threshold = Datetime.shift(now, threshold)

      if thread == :doc do
        CMS.DocTree.Archive.before(archive_threshold)
      else
        Lifecycle.archive_before(thread, archive_threshold)
      end
    end
  end

  @doc "Sinks an Article."
  @spec sink(Article.t(), keyword()) :: T.domain_res(term())
  def sink(%Article{inserted_at: inserted_at} = article, _opts) do
    update_stable_article(article, %{
      is_sunk: true,
      last_active_at: inserted_at,
      active_at: inserted_at
    })
  end

  @doc "Unsinks an Article."
  @spec undo_sink(Article.t(), keyword()) :: T.domain_res(term())
  def undo_sink(%Article{thread: thread} = article, _opts) do
    with true <- in_active_period?(thread, article),
         %Article{} = canonical <- Repo.get(Article, article.id) do
      update_stable_article(article, %{
        is_sunk: false,
        active_at: canonical.last_active_at
      })
    else
      false -> undo_sink_old_article("can not undo sink old article")
      nil -> {:error, ErrorCat.article_not_found("article not found")}
    end
  end

  @doc "Locks comments in the Article aggregate."
  @spec lock_comments(Article.t(), keyword()) :: T.domain_res(term())
  def lock_comments(%Article{} = article, _opts) do
    update_stable_article(article, %{comments_locked: true})
  end

  @doc "Unlocks comments in the Article aggregate."
  @spec undo_lock_comments(Article.t(), keyword()) :: T.domain_res(term())
  def undo_lock_comments(%Article{} = article, _opts) do
    update_stable_article(article, %{comments_locked: false})
  end

  defp in_active_period?(thread, article) do
    active_period_days = @active_period[thread] || @active_period[:default]

    inserted_at = Map.get(article, :inserted_at) || Map.get(article, :active_at)
    active_threshold = Datetime.now() |> Datetime.shift(days: -active_period_days)

    :gt == DateTime.compare(inserted_at, active_threshold)
  end

  defp update_stable_article(%Article{} = article, attrs) do
    article |> Article.changeset(attrs) |> Repo.update()
  end

  defp undo_sink_old_article(details), do: {:error, ErrorCat.undo_sink_old_article(details)}
end
