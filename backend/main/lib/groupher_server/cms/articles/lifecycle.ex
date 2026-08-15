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

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.ArticleLifecycle

  @states [:draft_only, :published, :archived, :deleted, :destroy]
  @public_readable_states [:published, :archived]
  @allowed_transitions %{
    draft_only: [:draft_only, :published, :deleted, :destroy],
    published: [:published, :archived, :deleted, :destroy],
    archived: [:archived, :deleted, :destroy],
    deleted: [:draft_only, :published, :deleted, :destroy],
    destroy: [:destroy]
  }

  @spec states() :: [ArticleLifecycle.state()]
  def states, do: @states

  @spec public_readable_states() :: [ArticleLifecycle.state()]
  def public_readable_states, do: @public_readable_states

  @doc """
  Creates lifecycle rows for Article records that entered outside the normal
  Draft producer, then leaves existing lifecycle authority untouched.

  This keeps operational maintenance commands safe for imported/legacy rows
  created after the one-time migration backfill.
  """
  @spec ensure_thread_backfill(atom(), DateTime.t()) :: non_neg_integer()
  def ensure_thread_backfill(thread, now) when thread in [:post, :blog, :changelog, :doc] do
    table = thread_table(thread)

    """
    INSERT INTO cms.article_lifecycles (
      community_id, thread, article_hash_id, state, version, changed_at, inserted_at, updated_at
    )
    SELECT
      article.community_id,
      $1,
      article.article_hash_id,
      CASE WHEN BOOL_OR(article.stage = 'public') THEN 'published' ELSE 'draft_only' END,
      1,
      $2,
      $2,
      $2
    FROM cms.#{table} AS article
    GROUP BY article.community_id, article.article_hash_id
    ON CONFLICT (community_id, thread, article_hash_id) DO NOTHING
    """
    |> Repo.query!([to_string(thread), now])
    |> Map.fetch!(:num_rows)
  end

  @spec state(integer(), atom(), Ecto.UUID.t()) ::
          {:ok, ArticleLifecycle.state()} | {:error, :lifecycle_not_found}
  def state(community_id, thread, article_hash_id) do
    case Repo.get_by(ArticleLifecycle,
           community_id: community_id,
           thread: thread,
           article_hash_id: article_hash_id
         ) do
      %ArticleLifecycle{state: state} -> {:ok, state}
      nil -> {:error, :lifecycle_not_found}
    end
  end

  @spec ensure_created(integer(), atom(), Ecto.UUID.t(), keyword()) ::
          {:ok, ArticleLifecycle.t()} | {:error, term()}
  def ensure_created(community_id, thread, article_hash_id, opts \\ [])
      when is_integer(community_id) and thread in [:post, :blog, :changelog, :doc] do
    attrs = %{
      community_id: community_id,
      thread: thread,
      article_hash_id: article_hash_id,
      state: Keyword.get(opts, :state, :draft_only),
      version: 1,
      changed_at: DateTime.utc_now(:second)
    }

    case Repo.get_by(ArticleLifecycle,
           community_id: community_id,
           thread: thread,
           article_hash_id: article_hash_id
         ) do
      %ArticleLifecycle{} = lifecycle ->
        {:ok, lifecycle}

      nil ->
        %ArticleLifecycle{}
        |> ArticleLifecycle.changeset(attrs)
        |> Repo.insert()
    end
  end

  @spec transition(integer(), atom(), Ecto.UUID.t(), ArticleLifecycle.state()) ::
          {:ok, ArticleLifecycle.t()} | {:error, :lifecycle_not_found | Ecto.Changeset.t()}
  def transition(community_id, thread, article_hash_id, state) when state in @states do
    lifecycle =
      ArticleLifecycle
      |> where(
        [lifecycle],
        lifecycle.community_id == ^community_id and lifecycle.thread == ^thread and
          lifecycle.article_hash_id == ^article_hash_id
      )
      |> lock("FOR UPDATE")
      |> Repo.one()

    case lifecycle do
      nil ->
        {:error, :lifecycle_not_found}

      %ArticleLifecycle{} = lifecycle ->
        transition(lifecycle, state)
    end
  end

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
      {:error, :lifecycle_state_conflict}
    end
  end

  @doc "Archives stale public heads through the Lifecycle authority."
  @spec archive_before(atom(), module(), DateTime.t(), DateTime.t()) :: non_neg_integer()
  def archive_before(thread, article_model, threshold, _now)
      when thread in [:post, :blog, :changelog, :doc] do
    operation_ref = Ecto.UUID.generate()

    {:ok, count} =
      Repo.transaction(fn ->
        candidate_ids =
          ArticleLifecycle
          |> join(:inner, [lifecycle], article in ^article_model,
            on:
              article.community_id == lifecycle.community_id and
                article.article_hash_id == lifecycle.article_hash_id
          )
          |> where(
            [lifecycle, article],
            lifecycle.thread == ^thread and lifecycle.state == :published and
              article.stage == :public and article.inserted_at < ^threshold
          )
          |> distinct([lifecycle, _article], lifecycle.id)
          |> select([lifecycle, _article], lifecycle.id)
          |> Repo.all()

        lifecycles =
          Enum.map(candidate_ids, fn id ->
            ArticleLifecycle
            |> where([lifecycle], lifecycle.id == ^id)
            |> lock("FOR UPDATE")
            |> Repo.one!()
          end)

        Enum.reduce_while(lifecycles, 0, fn lifecycle, count ->
          with {:ok, archived} <- transition(lifecycle, :archived),
               {:ok, _audit} <-
                 GroupherServer.CMS.Audit.record("article.archived", %{
                   community_id: archived.community_id,
                   resource_type: to_string(thread),
                   resource_ref: archived.article_hash_id,
                   resource_snapshot: %{from_state: lifecycle.state, to_state: archived.state},
                   operation_ref: operation_ref,
                   source: "maintenance",
                   metadata: %{batch: true}
                 }) do
            {:cont, count + 1}
          else
            {:error, reason} -> Repo.rollback(reason)
          end
        end)
      end)

    count
  end

  defp state_time(state, state, now, _current), do: now
  defp state_time(_state, _target, _now, current), do: current

  defp thread_table(:post), do: "posts"
  defp thread_table(:blog), do: "blogs"
  defp thread_table(:changelog), do: "changelogs"
  defp thread_table(:doc), do: "docs"
end
