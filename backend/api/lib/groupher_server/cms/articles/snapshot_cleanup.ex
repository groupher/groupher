defmodule GroupherServer.CMS.Articles.SnapshotCleanup do
  @moduledoc """
  Removes expired, unselected ordinary Article Snapshots and their owned assets.

  A seven-day retention window keeps recently published and forkable history.
  The current Public head is excluded explicitly; other formal references are
  protected by their database foreign keys. Each candidate has its own transaction
  so a concurrent or external RESTRICT reference skips only that Snapshot.

  Business position:

      scheduled cleanup -> expired unselected Snapshot -> delete owner refs -> Snapshot -> orphan CoverEditSnapshot
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleAssetRef, ArticlePublic, ArticleSnapshot, CoverEditSnapshot}

  @retention_days 7
  @default_batch_size 100

  @doc "Deletes one bounded batch of expired, unselected Post/Blog/Changelog Snapshots."
  @spec run(keyword()) :: {:ok, non_neg_integer()} | {:error, term()}
  def run(opts \\ []) do
    case run_page(opts) do
      {:ok, %{deleted_count: count}} -> {:ok, count}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Deletes one page and returns a cursor for the next page when needed."
  @spec run_page(keyword()) :: {:ok, map()} | {:error, term()}
  def run_page(opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())
    batch_size = Keyword.get(opts, :batch_size, @default_batch_size)
    cursor = Keyword.get(opts, :cursor)

    cond do
      Repo.in_transaction?() ->
        {:error, :nested_cleanup_transaction}

      not match?(%DateTime{}, now) or not is_integer(batch_size) or batch_size <= 0 or
          not valid_cursor?(cursor) ->
        {:error, :invalid_snapshot_cleanup_page}

      true ->
        expires_before = DateTime.add(now, -@retention_days, :day)
        candidates = expired_candidates(expires_before, batch_size, cursor)

        case Enum.reduce_while(candidates, {:ok, 0}, fn snapshot, {:ok, count} ->
               case delete_candidate(snapshot, expires_before) do
                 {:ok, :deleted} -> {:cont, {:ok, count + 1}}
                 {:ok, :retained} -> {:cont, {:ok, count}}
                 {:error, reason} -> {:halt, {:error, reason}}
               end
             end) do
          {:ok, count} ->
            next_cursor =
              if length(candidates) == batch_size do
                last = List.last(candidates)
                %{captured_at: last.captured_at, id: last.id}
              end

            {:ok, %{deleted_count: count, next_cursor: next_cursor}}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  defp valid_cursor?(nil), do: true

  defp valid_cursor?(%{captured_at: %DateTime{}, id: id}) do
    match?({:ok, _id}, Ecto.UUID.cast(id))
  end

  defp valid_cursor?(_cursor), do: false

  defp expired_candidates(expires_before, batch_size, cursor) do
    article_ids =
      from(article in Article,
        where: article.thread in [:post, :blog, :changelog],
        select: article.id
      )

    public_reference =
      from(public in ArticlePublic,
        where: public.snapshot_id == parent_as(:snapshot).id,
        select: 1
      )

    ArticleSnapshot
    |> from(as: :snapshot)
    |> where([snapshot], snapshot.article_id in subquery(article_ids))
    |> where([snapshot], snapshot.captured_at <= ^expires_before)
    |> where([snapshot], not exists(public_reference))
    |> after_cursor(cursor)
    |> order_by([snapshot], asc: snapshot.captured_at, asc: snapshot.id)
    |> limit(^batch_size)
    |> Repo.all()
  end

  defp after_cursor(query, nil), do: query

  defp after_cursor(query, %{captured_at: captured_at, id: id}) do
    where(
      query,
      [snapshot],
      snapshot.captured_at > ^captured_at or
        (snapshot.captured_at == ^captured_at and snapshot.id > ^id)
    )
  end

  defp delete_candidate(candidate, expires_before) do
    try do
      Repo.transaction(fn ->
        article =
          Repo.one(
            from(article in Article,
              where: article.id == ^candidate.article_id,
              lock: "FOR UPDATE"
            )
          )

        if is_nil(article) do
          :retained
        else
          public =
            Repo.one(
              from(public in ArticlePublic,
                where: public.article_id == ^article.id,
                lock: "FOR UPDATE"
              )
            )

          snapshot =
            Repo.one(
              from(snapshot in ArticleSnapshot,
                where: snapshot.id == ^candidate.id and snapshot.article_id == ^article.id,
                where: snapshot.captured_at <= ^expires_before,
                lock: "FOR UPDATE"
              )
            )

          if is_nil(snapshot) or (public && public.snapshot_id == snapshot.id) do
            :retained
          else
            case delete_snapshot(snapshot) do
              {:ok, result} -> result
              {:error, reason} -> Repo.rollback(reason)
            end
          end
        end
      end)
    catch
      :throw, :snapshot_referenced -> {:ok, :retained}
    end
  end

  defp delete_snapshot(%ArticleSnapshot{} = snapshot) do
    Repo.delete_all(from(ref in ArticleAssetRef, where: ref.snapshot_id == ^snapshot.id))

    result =
      try do
        Repo.delete(snapshot)
      rescue
        error in [Postgrex.Error, Ecto.ConstraintError] ->
          if foreign_key_violation?(error) do
            throw(:snapshot_referenced)
          else
            reraise error, __STACKTRACE__
          end
      end

    case result do
      {:ok, _deleted} ->
        delete_cover_snapshot(snapshot.cover_edit_snapshot_id)

      {:error, changeset} ->
        {:error, {:snapshot_delete_failed, changeset}}
    end
  end

  defp delete_cover_snapshot(nil), do: {:ok, :deleted}

  defp delete_cover_snapshot(cover_snapshot_id) do
    case Repo.get(CoverEditSnapshot, cover_snapshot_id) do
      nil ->
        {:ok, :deleted}

      cover_snapshot ->
        case Repo.delete(cover_snapshot) do
          {:ok, _deleted} -> {:ok, :deleted}
          {:error, changeset} -> {:error, {:cover_snapshot_delete_failed, changeset}}
        end
    end
  end

  defp foreign_key_violation?(%Postgrex.Error{postgres: %{code: :foreign_key_violation}}),
    do: true

  defp foreign_key_violation?(%Ecto.ConstraintError{type: :foreign_key}), do: true

  defp foreign_key_violation?(_error), do: false
end
