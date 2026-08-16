defmodule GroupherServer.CMS.Docs.Lifecycle do
  @moduledoc """
  Branch-scoped lifecycle commands for Docs.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.{DocBranch, DocLifecycle}

  @states [:draft_only, :published, :archived, :deleted, :destroy]
  @public_readable_states [:published, :archived]
  @allowed_transitions %{
    draft_only: [:draft_only, :published, :deleted, :destroy],
    published: [:published, :archived, :deleted, :destroy],
    archived: [:archived, :deleted, :destroy],
    deleted: [:draft_only, :published, :deleted, :destroy],
    destroy: [:destroy]
  }

  def states, do: @states
  def public_readable_states, do: @public_readable_states

  def state(community_id, branch_id, article_hash_id) do
    case Repo.get_by(DocLifecycle,
           community_id: community_id,
           branch_id: branch_id,
           article_hash_id: article_hash_id
         ) do
      %DocLifecycle{state: state} -> {:ok, state}
      nil -> {:error, :lifecycle_not_found}
    end
  end

  def ensure_created(community_id, branch_id, article_hash_id, opts \\ [])
      when is_integer(community_id) and is_integer(branch_id) do
    attrs = %{
      community_id: community_id,
      branch_id: branch_id,
      article_hash_id: article_hash_id,
      state: Keyword.get(opts, :state, :draft_only),
      version: 1,
      changed_at: DateTime.utc_now(:second)
    }

    case Repo.get_by(DocLifecycle, Map.take(attrs, [:community_id, :branch_id, :article_hash_id])) do
      %DocLifecycle{} = lifecycle -> {:ok, lifecycle}
      nil -> %DocLifecycle{} |> DocLifecycle.changeset(attrs) |> Repo.insert()
    end
  end

  def transition(community_id, branch_id, article_hash_id, state) when state in @states do
    lifecycle =
      DocLifecycle
      |> where(
        [lifecycle],
        lifecycle.community_id == ^community_id and lifecycle.branch_id == ^branch_id and
          lifecycle.article_hash_id == ^article_hash_id
      )
      |> lock("FOR UPDATE")
      |> Repo.one()

    case lifecycle do
      nil -> {:error, :lifecycle_not_found}
      %DocLifecycle{} = lifecycle -> transition(lifecycle, state)
    end
  end

  def transition(%DocLifecycle{} = lifecycle, state) when state in @states do
    if state in Map.fetch!(@allowed_transitions, lifecycle.state) do
      now = DateTime.utc_now(:second)

      lifecycle
      |> DocLifecycle.changeset(%{
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

  def archive_before(
        %DocBranch{} = branch,
        article_model,
        threshold,
        _now
      ) do
    Repo.transaction(fn ->
      candidates =
        article_model
        |> join(:inner, [article], lifecycle in DocLifecycle,
          on:
            lifecycle.community_id == article.community_id and
              lifecycle.branch_id == ^branch.id and
              lifecycle.article_hash_id == article.article_hash_id
        )
        |> where([article, lifecycle], lifecycle.state == :published and article.stage == :public)
        |> where([article, _lifecycle], article.inserted_at < ^threshold)
        |> select([_article, lifecycle], lifecycle)
        |> lock("FOR UPDATE")
        |> Repo.all()

      Enum.reduce(candidates, 0, fn lifecycle, count ->
        case transition(lifecycle, :archived) do
          {:ok, _} -> count + 1
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end)
  end

  defp state_time(state, state, now, _current), do: now
  defp state_time(_state, _target, _now, current), do: current
end
