defmodule GroupherServer.CMS.Articles.Lifecycle do
  @moduledoc """
  Lifecycle authority for a logical Article, independent of its draft/public
  version rows.

  Business position:

      CMS command
        -> Article Lifecycle
        -> Repo / state transition
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Workflow
  alias CMS.Articles.{Bindings, Effects, ErrorCat}
  alias CMS.Model.{Article, ArticleLifecycle}
  alias CMS.ReviewBlocks

  @article_threads CMS.Artiment.Config.threads() -- [:doc]

  @states [:draft_only, :published, :archived, :deleted, :destroy]
  @public_readable_states [:published, :archived]
  @allowed_transitions %{
    draft_only: [:draft_only, :published, :deleted, :destroy],
    published: [:published, :archived, :deleted, :destroy],
    archived: [:archived, :deleted, :destroy],
    deleted: [:draft_only, :published, :deleted, :destroy],
    destroy: [:destroy]
  }

  @doc "Returns all possible lifecycle states for a logical Article."
  @spec states() :: [ArticleLifecycle.state()]
  def states, do: @states

  @doc "Returns the lifecycle states readable through the public gate."
  @spec public_readable_states() :: [ArticleLifecycle.state()]
  def public_readable_states, do: @public_readable_states

  @doc "Transitions a Lifecycle row already locked by its command loader."
  @spec transition(ArticleLifecycle.t(), ArticleLifecycle.state()) ::
          {:ok, ArticleLifecycle.t()} | {:error, Ecto.Changeset.t() | :lifecycle_state_conflict}
  def transition(%ArticleLifecycle{} = lifecycle, state) when state in @states do
    if state in Map.fetch!(@allowed_transitions, lifecycle.state) do
      now = DateTime.utc_now(:second)

      with {:ok, updated} <-
             lifecycle
             |> ArticleLifecycle.changeset(%{
               state: state,
               version: lifecycle.version + 1,
               changed_at: now,
               archived_at: state_time(state, :archived, now, lifecycle.archived_at),
               deleted_at: state_time(state, :deleted, now, lifecycle.deleted_at),
               destroyed_at: state_time(state, :destroy, now, lifecycle.destroyed_at)
             })
             |> Repo.update(),
           {:ok, :pass} <- ReviewBlocks.recompute(updated) do
        {:ok, updated}
      end
    else
      {:error, ErrorCat.lifecycle_state_conflict()}
    end
  end

  @doc """
  Applies one scope-specific review restriction inside the caller's locked Article transaction.

  ## Examples

      Articles.Lifecycle.apply_review_block(locked_lifecycle, attrs)
  """
  @spec apply_review_block(ArticleLifecycle.t(), map()) ::
          {:ok, struct()} | {:error, term()}
  def apply_review_block(%ArticleLifecycle{} = lifecycle, attrs) do
    ReviewBlocks.apply(lifecycle, attrs)
  end

  @doc """
  Ends the selected active restrictions and recomputes Article/Binding public projections.

  ## Examples

      Articles.Lifecycle.end_review_blocks(lifecycle, scope_key, ids, operation_ref, reason)
  """
  @spec end_review_blocks(
          ArticleLifecycle.t(),
          String.t(),
          [term()],
          Ecto.UUID.t(),
          String.t()
        ) ::
          {:ok, :pass} | {:error, term()}
  def end_review_blocks(
        %ArticleLifecycle{} = lifecycle,
        scope_key,
        ids,
        operation_ref,
        reason
      ) do
    ReviewBlocks.end_blocks(lifecycle, scope_key, ids, operation_ref, reason)
  end

  @doc "Locks and returns the Lifecycle row belonging to a stable Article."
  @spec lock(Article.t()) :: {:ok, ArticleLifecycle.t()} | {:error, ErrorCat.error()}
  def lock(%Article{id: article_id}) do
    ArticleLifecycle
    |> where([lifecycle], lifecycle.article_id == ^article_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      %ArticleLifecycle{} = lifecycle -> {:ok, lifecycle}
      nil -> {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  @doc "Transitions a stable Article with an optimistic Lifecycle version guard."
  @spec transition(Article.t(), ArticleLifecycle.state(), pos_integer()) ::
          {:ok, ArticleLifecycle.t()} | {:error, term()}
  def transition(%Article{} = article, state, expected_version) when state in @states do
    Repo.transaction(fn ->
      with {:ok, lifecycle} <- lock(article),
           {:ok, _} <- ensure_version(lifecycle.version, expected_version),
           {:ok, updated} <- transition(lifecycle, state) do
        updated
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> case do
      {:ok, updated} -> {:ok, updated}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Archives at most 100 stale public heads through the Lifecycle authority.

  Candidate Article timestamps are rechecked after locking the Article row;
  recently active or already-transitioned rows are skipped. Each successful
  transition records its Activity in the same transaction.

  ## Examples

      CMS.Articles.Lifecycle.archive_before(:blog, threshold)
      #=> {:ok, archived_count} | {:error, reason}
  """
  @spec archive_before(atom(), DateTime.t()) :: {:ok, non_neg_integer()} | {:error, term()}
  def archive_before(thread, threshold)
      when thread in @article_threads and is_struct(threshold, DateTime) do
    operation_ref = Ecto.UUID.generate()

    Workflow.transaction(fn ->
      candidates =
        ArticleLifecycle
        |> join(:inner, [lifecycle], article in Article, on: article.id == lifecycle.article_id)
        |> where(
          [lifecycle, article],
          lifecycle.thread == ^thread and lifecycle.state == :published and
            article.active_at < ^threshold
        )
        |> order_by([_lifecycle, article], asc: article.id)
        |> limit(100)
        |> select([lifecycle, article], {lifecycle.id, article.id})
        |> Repo.all()

      Enum.reduce_while(candidates, 0, fn {lifecycle_id, article_id}, count ->
        case archive_candidate(lifecycle_id, article_id, thread, threshold, operation_ref) do
          {:ok, :skipped} -> {:cont, count}
          {:ok, :archived} -> {:cont, count + 1}
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end)
  end

  defp archive_candidate(lifecycle_id, article_id, thread, threshold, operation_ref) do
    article =
      Article
      |> where([article], article.id == ^article_id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    case article do
      %Article{thread: ^thread, active_at: %DateTime{} = active_at} ->
        if DateTime.compare(active_at, threshold) == :lt do
          archive_locked_candidate(lifecycle_id, article, thread, operation_ref)
        else
          {:ok, :skipped}
        end

      _article ->
        {:ok, :skipped}
    end
  end

  defp archive_locked_candidate(lifecycle_id, article, thread, operation_ref) do
    lifecycle =
      ArticleLifecycle
      |> where([lifecycle], lifecycle.id == ^lifecycle_id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    case lifecycle do
      %ArticleLifecycle{thread: ^thread, state: :published} ->
        with {:ok, archived} <- transition(lifecycle, :archived),
             {:ok, _activity} <- log_archived(article, archived, operation_ref) do
          {:ok, :archived}
        end

      %ArticleLifecycle{} ->
        {:ok, :skipped}

      nil ->
        {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  @doc "Answers whether an Article lifecycle permits an edit command to begin."
  @spec editable?(ArticleLifecycle.t() | %{state: ArticleLifecycle.state()} | term()) ::
          {:ok, boolean()} | {:error, ErrorCat.error()}
  def editable?(%ArticleLifecycle{state: state}), do: editable_state(state)
  def editable?(%{state: state}), do: editable_state(state)
  def editable?(_lifecycle), do: {:error, ErrorCat.lifecycle_not_found()}

  defp editable_state(state) when state in [:draft_only, :published], do: {:ok, true}
  defp editable_state(state) when state in @states, do: {:ok, false}
  defp editable_state(_state), do: {:error, ErrorCat.lifecycle_not_found()}

  defp log_archived(article, archived, operation_ref) do
    with {:ok, bindings} <- Bindings.all(article) do
      Enum.reduce_while(bindings, {:ok, :pass}, fn binding, {:ok, :pass} ->
        resource = Map.put(article, :community, binding.community)

        case Effects.activity(resource, :archived,
               operation_ref: operation_ref,
               source: :maintenance,
               occurred_at: archived.changed_at,
               metadata: %{batch: true}
             ) do
          {:ok, _event} -> {:cont, {:ok, :pass}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    end
  end

  defp state_time(state, state, now, _current), do: now
  defp state_time(_state, _target, _now, current), do: current

  defp ensure_version(version, version), do: {:ok, :pass}
  defp ensure_version(_actual, _expected), do: {:error, :lifecycle_version_conflict}
end
