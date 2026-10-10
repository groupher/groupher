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
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.ErrorCat
  alias CMS.{Articles.Lifecycle, Artiment.Const, Comments.Writer}
  alias CMS.Docs.Lifecycle, as: DocLifecycle

  alias CMS.Model.{
    Article,
    ArticleBinding,
    DocBranch,
    DocBranchState,
    KanbanState,
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
         {:ok, _} <- Writer.batch_update_question_flag(article, cat == @article_cat.qa) do
      {:ok, article}
    else
      nil -> {:error, ErrorCat.article_not_found("article not found")}
      {:error, reason} -> {:error, reason}
    end
  end

  @spec set_status(Article.t(), Const.status_enum() | nil, pos_integer()) ::
          T.domain_res(Article.t())
  def set_status(%Article{thread: :post} = article, status, community_id)
      when is_integer(community_id) do
    with %ArticleBinding{} = binding <-
           Repo.get_by(ArticleBinding, article_id: article.id, community_id: community_id),
         {:ok, _state} <- put_kanban_state(binding, status) do
      {:ok, article}
    else
      nil -> {:error, ErrorCat.article_not_found("article binding not found")}
      {:error, reason} -> {:error, reason}
    end
  end

  def set_status(%Article{}, _status, _community_id) do
    {:error, ErrorCat.article_not_found("post not found")}
  end

  defp put_kanban_state(%ArticleBinding{id: article_binding_id}, nil) do
    Repo.delete_all(
      from(state in KanbanState, where: state.article_binding_id == ^article_binding_id)
    )

    {:ok, :removed}
  end

  defp put_kanban_state(%ArticleBinding{id: article_binding_id}, status) do
    %KanbanState{}
    |> KanbanState.changeset(%{article_binding_id: article_binding_id, status: status})
    |> Repo.insert(
      on_conflict: [set: [status: status, updated_at: DateTime.utc_now(:second)]],
      conflict_target: [:article_binding_id],
      returning: true
    )
  end

  @spec update_active_timestamp(atom(), term()) :: T.domain_res(term())
  def update_active_timestamp(:doc, %{id: article_id, branch_id: branch_id} = article)
      when is_binary(article_id) and is_integer(branch_id) do
    if in_active_period?(:doc, article) do
      with %DocBranchState{} = state <-
             Repo.get_by(DocBranchState, article_id: article_id, branch_id: branch_id),
           {:ok, _state} <-
             state
             |> DocBranchState.changeset(%{active_at: DateTime.utc_now(:second)})
             |> Repo.update() do
        {:ok, article}
      else
        nil -> {:error, ErrorCat.article_not_found("doc branch state not found")}
        {:error, reason} -> {:error, reason}
      end
    else
      {:ok, :pass}
    end
  end

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
  def archive(:doc) do
    now = Datetime.now(:second)
    threshold = Datetime.shift(now, @archive_threshold[:doc] || @archive_threshold[:default])

    DocBranch
    |> where([branch], branch.status == :active)
    |> Repo.all()
    |> Enum.reduce_while({:ok, 0}, fn branch, {:ok, archived_count} ->
      case DocLifecycle.archive_before(branch, threshold) do
        {:ok, count} -> {:cont, {:ok, archived_count + count}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  def archive(thread) do
    with {:ok, info} <- match(thread) do
      now = Datetime.now(:second)
      threshold = @archive_threshold[thread] || @archive_threshold[:default]
      archive_threshold = Datetime.shift(now, threshold)

      Lifecycle.archive_before(thread, info.model, archive_threshold, now)
      |> done()
    end
  end

  @doc "Sinks an ordinary Article or an explicit Doc branch."
  @spec sink(Article.t(), keyword()) :: T.domain_res(term())
  def sink(%Article{thread: :doc} = article, opts) do
    update_doc_branch_state(article, opts, %{
      is_sunk: true,
      last_active_at: article.inserted_at,
      active_at: article.inserted_at
    })
  end

  def sink(%Article{inserted_at: inserted_at} = article, _opts) do
    update_stable_article(article, %{
      is_sunk: true,
      last_active_at: inserted_at,
      active_at: inserted_at
    })
  end

  @doc "Unsinks an ordinary Article or an explicit Doc branch."
  @spec undo_sink(Article.t(), keyword()) :: T.domain_res(term())
  def undo_sink(%Article{thread: :doc} = article, opts) do
    with branch_id when is_integer(branch_id) <- Keyword.get(opts, :branch_id),
         %DocBranchState{} = state <-
           Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id),
         true <- in_active_period?(:doc, state) do
      state
      |> DocBranchState.changeset(%{is_sunk: false, active_at: state.last_active_at})
      |> Repo.update()
    else
      false -> undo_sink_old_article("can not undo sink old article")
      _ -> {:error, ErrorCat.article_not_found("doc branch state not found")}
    end
  end

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

  @doc "Locks comments in the Article aggregate or one Doc branch state."
  @spec lock_comments(Article.t(), keyword()) :: T.domain_res(term())
  def lock_comments(%Article{thread: :doc} = article, opts) do
    update_doc_branch_state(article, opts, %{comments_locked: true})
  end

  def lock_comments(%Article{} = article, _opts) do
    update_stable_article(article, %{comments_locked: true})
  end

  @doc "Unlocks comments in the Article aggregate or one Doc branch state."
  @spec undo_lock_comments(Article.t(), keyword()) :: T.domain_res(term())
  def undo_lock_comments(%Article{thread: :doc} = article, opts) do
    update_doc_branch_state(article, opts, %{comments_locked: false})
  end

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

  defp update_doc_branch_state(article, opts, attrs) do
    with branch_id when is_integer(branch_id) <- Keyword.get(opts, :branch_id),
         %DocBranchState{} = state <-
           Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id) do
      state |> DocBranchState.changeset(attrs) |> Repo.update()
    else
      _ -> {:error, ErrorCat.article_not_found("doc branch state not found")}
    end
  end

  defp undo_sink_old_article(details), do: {:error, ErrorCat.undo_sink_old_article(details)}
end
