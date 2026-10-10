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

  alias GroupherServer.{Activity, CMS, Repo}
  alias CMS.Articles.{Bindings, ErrorCat}
  alias CMS.Model.{Article, ArticleLifecycle}

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

      lifecycle
      |> ArticleLifecycle.changeset(%{
        state: state,
        version: lifecycle.version + 1,
        changed_at: now,
        archived_at: state_time(state, :archived, now, lifecycle.archived_at),
        deleted_at: state_time(state, :deleted, now, lifecycle.deleted_at),
        destroyed_at: state_time(state, :destroy, now, lifecycle.destroyed_at)
      })
      |> Repo.update()
    else
      {:error, ErrorCat.lifecycle_state_conflict()}
    end
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
    with {:ok, lifecycle} <- lock(article),
         {:ok, _} <- ensure_version(lifecycle.version, expected_version) do
      transition(lifecycle, state)
    end
  end

  @doc "Archives stale public heads through the Lifecycle authority."
  @spec archive_before(atom(), module(), DateTime.t(), DateTime.t()) :: non_neg_integer()
  def archive_before(thread, _article_model, threshold, _now)
      when thread in @article_threads do
    operation_ref = Ecto.UUID.generate()

    {:ok, count} =
      Repo.transaction(fn ->
        candidates =
          ArticleLifecycle
          |> join(:inner, [lifecycle], article in Article, on: article.id == lifecycle.article_id)
          |> where(
            [lifecycle, article],
            lifecycle.thread == ^thread and lifecycle.state == :published and
              article.active_at < ^threshold
          )
          |> select([lifecycle, article], {lifecycle.id, article.id})
          |> Repo.all()

        lifecycles =
          Enum.map(candidates, fn {lifecycle_id, article_id} ->
            ArticleLifecycle
            |> where([lifecycle], lifecycle.id == ^lifecycle_id)
            |> lock("FOR UPDATE")
            |> Repo.one!()
            |> then(&{&1, Repo.get!(Article, article_id)})
          end)

        Enum.reduce_while(lifecycles, 0, fn {lifecycle, article}, count ->
          with {:ok, archived} <- transition(lifecycle, :archived),
               {:ok, _activity} <- log_archived(article, archived, operation_ref) do
            {:cont, count + 1}
          else
            {:error, reason} -> Repo.rollback(reason)
          end
        end)
      end)

    count
  end

  defp log_archived(article, archived, operation_ref) do
    with {:ok, bindings} <- Bindings.all(article) do
      Enum.reduce_while(bindings, {:ok, :pass}, fn binding, {:ok, :pass} ->
        resource = Map.put(article, :community, binding.community)

        case Activity.log(resource, :archived,
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
