defmodule GroupherServer.CMS.Articles.WorkingCopy.History.Query do
  @moduledoc """
  Reads immutable Article history after Article-scoped Passport admission.

      Article identity -> article.history.read -> sequence page / event / version diff
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.Articles.WorkingCopy.Diff
  alias CMS.Model.{Article, ArticleEvent, ArticleSnapshot, ArticleWorkingCopy}
  alias Accounts.Model.User

  @default_limit 20
  @max_limit 50

  @contributors_lineage_sql """
  WITH RECURSIVE lineage(event_id) AS (
    SELECT anchor.id
    FROM (
      SELECT id
      FROM cms.article_events
      WHERE article_id = $1::uuid
        AND after_snapshot_id = $2::uuid
        AND type <> 'publish'
      ORDER BY sequence DESC
      LIMIT 1
    ) AS anchor

    UNION

    SELECT parent.id
    FROM lineage AS child
    JOIN cms.article_events AS current_event ON current_event.id = child.event_id
    JOIN LATERAL (
      SELECT previous_event.id AS id
      FROM cms.article_events AS previous_event
      WHERE previous_event.article_id = current_event.article_id
        AND previous_event.id = current_event.previous_event_id
        AND current_event.before_snapshot_id IS DISTINCT FROM $3::uuid

      UNION

      SELECT source_event.id AS id
      FROM cms.article_events AS source_event
      WHERE source_event.article_id = current_event.article_id
        AND source_event.after_snapshot_id = current_event.source_snapshot_id
        AND source_event.type <> 'publish'
        AND current_event.source_snapshot_id IS NOT NULL
        AND current_event.source_snapshot_id IS DISTINCT FROM $3::uuid
        AND source_event.id = (
          SELECT latest_source_event.id
          FROM cms.article_events AS latest_source_event
          WHERE latest_source_event.article_id = current_event.article_id
            AND latest_source_event.after_snapshot_id = current_event.source_snapshot_id
            AND latest_source_event.type <> 'publish'
          ORDER BY latest_source_event.sequence DESC
          LIMIT 1
        )

      UNION

      SELECT before_event.id AS id
      FROM cms.article_events AS before_event
      WHERE before_event.article_id = current_event.article_id
        AND before_event.after_snapshot_id = current_event.before_snapshot_id
        AND before_event.type <> 'publish'
        AND current_event.previous_event_id IS NULL
        AND current_event.source_snapshot_id IS NULL
        AND current_event.before_snapshot_id IS NOT NULL
        AND current_event.before_snapshot_id IS DISTINCT FROM $3::uuid
        AND before_event.id = (
          SELECT latest_before_event.id
          FROM cms.article_events AS latest_before_event
          WHERE latest_before_event.article_id = current_event.article_id
            AND latest_before_event.after_snapshot_id = current_event.before_snapshot_id
            AND latest_before_event.type <> 'publish'
          ORDER BY latest_before_event.sequence DESC
          LIMIT 1
        )
    ) AS parent ON TRUE
  )
  SELECT event_id FROM lineage
  """

  @doc "Returns an Article's immutable events in descending sequence order."
  def paged_events(article_id, actor, opts \\ [])

  def paged_events(article_id, %User{} = actor, opts) when is_list(opts) do
    with {:ok, article} <- load_article(article_id),
         {:ok, :pass} <- authorize(article, actor, CMS.GateAction.article_history_read()),
         {:ok, cursor} <- cursor(opts[:cursor] || pagi_value(opts[:pagi], :cursor)),
         {:ok, actor_id} <- actor_id_filter(opts[:actor_id]),
         limit <- normalize_limit(opts[:limit] || pagi_value(opts[:pagi], :limit)) do
      query =
        from(event in ArticleEvent,
          where: event.article_id == ^article.id,
          order_by: [desc: event.sequence],
          limit: ^(limit + 1)
        )

      query = if opts[:type], do: where(query, [event], event.type == ^opts[:type]), else: query
      query = if actor_id, do: where(query, [event], event.actor_id == ^actor_id), else: query
      query = if cursor, do: where(query, [event], event.sequence < ^cursor), else: query
      rows = Repo.all(query)
      items = Enum.take(rows, limit)

      {:ok,
       %{
         items: Enum.map(items, &event_summary/1),
         next_cursor: if(length(rows) > limit, do: List.last(items).sequence)
       }}
    end
  end

  def paged_events(_article_id, _actor, _opts), do: {:error, :article_history_unavailable}

  @doc "Returns one event only when it belongs to the authorized Article."
  def event(article_id, event_id, actor, opts \\ [])

  def event(article_id, event_id, %User{} = actor, opts) when is_list(opts) do
    with {:ok, article} <- load_article(article_id),
         {:ok, :pass} <- authorize(article, actor, CMS.GateAction.article_history_read()),
         {:ok, event_id} <- cast_uuid(event_id),
         %ArticleEvent{} = event <- Repo.get(ArticleEvent, event_id),
         true <- event.article_id == article.id,
         {:ok, diff} <- event_diff(event),
         {:ok, contributors} <- contributors_page(event, opts) do
      {:ok, Map.merge(event_summary(event), %{diff: diff, contributors: contributors})}
    else
      _ -> {:error, :article_history_unavailable}
    end
  end

  def event(_article_id, _event_id, _actor, _opts) do
    {:error, :article_history_unavailable}
  end

  @doc "Checks whether a user contributed content to one published Snapshot's same-Article lineage."
  def contributor_to_snapshot?(article_id, snapshot_id, user_id)
      when is_binary(article_id) and is_binary(snapshot_id) and is_integer(user_id) and
             user_id > 0 do
    publish =
      Repo.one(
        from(event in ArticleEvent,
          where:
            event.article_id == ^article_id and event.type == :publish and
              event.after_snapshot_id == ^snapshot_id,
          order_by: [desc: event.sequence],
          limit: 1
        )
      )

    case publish do
      %ArticleEvent{} ->
        with {:ok, events} <- contributor_events(publish),
             true <- contributor_lineage_complete?(publish, events) do
          {:ok,
           Enum.any?(events, fn event ->
             event.type in [:create, :edit, :restore] and event.actor_type == :user and
               event.actor_id == user_id
           end)}
        else
          false -> {:error, :article_history_unavailable}
          {:error, _reason} = error -> error
        end

      nil ->
        {:error, :article_history_unavailable}
    end
  end

  def contributor_to_snapshot?(_article_id, _snapshot_id, _user_id) do
    {:error, :article_history_unavailable}
  end

  @doc "Compares a fixed Snapshot with another Snapshot or the current WorkingCopy."
  def compare(article_id, before, after_version, %User{} = actor) do
    with {:ok, article} <- load_article(article_id),
         {:ok, :pass} <- authorize(article, actor, CMS.GateAction.article_history_read()),
         {:ok, before_id} <- snapshot_ref(before),
         %ArticleSnapshot{article_id: article_id} = before_snapshot <-
           Repo.get(ArticleSnapshot, before_id),
         true <- article_id == article.id,
         {:ok, after_record} <- after_ref(after_version, article, actor),
         {:ok, diff} <- Diff.compare_versions(before_snapshot, after_record) do
      {:ok, Map.put(diff, :article_id, article.id)}
    else
      {:error, :article_working_copy_revision_conflict} = error -> error
      _ -> {:error, :article_history_unavailable}
    end
  end

  def compare(_article_id, _before, _after, _actor) do
    {:error, :article_history_unavailable}
  end

  defp load_article(article_id) do
    with {:ok, article_id} <- cast_uuid(article_id),
         %Article{} = article <- Repo.get(Article, article_id) do
      {:ok, Repo.preload(article, :author)}
    else
      _ -> {:error, :article_history_unavailable}
    end
  end

  defp authorize(%Article{} = article, %User{} = actor, action) do
    with {:ok, scope} <- CMS.Passport.load_article_scope(actor, article),
         {:ok, true} <- CMS.Passport.allowed?(actor, scope, action) do
      {:ok, :pass}
    else
      _ -> {:error, :article_history_unavailable}
    end
  end

  defp event_summary(%ArticleEvent{} = event) do
    %{
      id: event.id,
      sequence: event.sequence,
      type: event.type,
      actor_type: event.actor_type,
      actor_id: event.actor_id,
      actor: event.actor_snapshot,
      source: event.source,
      occurred_at: event.occurred_at,
      before_snapshot_id: event.before_snapshot_id,
      after_snapshot_id: event.after_snapshot_id,
      before_revision: event.before_revision,
      after_revision: event.after_revision,
      source_snapshot_id: event.source_snapshot_id
    }
  end

  defp event_diff(%ArticleEvent{before_snapshot_id: nil}), do: {:ok, nil}

  defp event_diff(%ArticleEvent{before_snapshot_id: before_id, after_snapshot_id: after_id}) do
    Diff.compare(before_id, after_id)
  end

  defp contributors_page(%ArticleEvent{type: :publish} = publish, opts) do
    with {:ok, cursor} <- cursor(opts[:cursor] || pagi_value(opts[:pagi], :cursor)) do
      with {:ok, events} <- contributor_events(publish) do
        complete? = contributor_lineage_complete?(publish, events)
        {:ok, paginate_contributors(events, complete?, cursor, opts)}
      end
    end
  end

  defp contributors_page(_event, _opts) do
    {:ok, %{items: [], next_cursor: nil, unknown: false}}
  end

  defp contributor_events(%ArticleEvent{} = publish) do
    case Repo.query(@contributors_lineage_sql, [
           Ecto.UUID.dump!(publish.article_id),
           Ecto.UUID.dump!(publish.after_snapshot_id),
           if(publish.before_snapshot_id,
             do: Ecto.UUID.dump!(publish.before_snapshot_id),
             else: nil
           )
         ]) do
      {:ok, %{rows: rows}} ->
        event_ids = Enum.map(rows, fn [event_id] -> event_id end)

        events =
          if event_ids == [] do
            []
          else
            Repo.all(
              from(event in ArticleEvent,
                where: event.article_id == ^publish.article_id and event.id in ^event_ids,
                order_by: [asc: event.sequence]
              )
            )
          end

        {:ok, events}

      {:error, _reason} ->
        {:error, :article_history_unavailable}
    end
  end

  defp contributor_lineage_complete?(publish, events) do
    ids = MapSet.new(events, & &1.id)

    by_snapshot =
      events
      |> Enum.group_by(& &1.after_snapshot_id)
      |> Map.new(fn {snapshot_id, snapshot_events} ->
        {snapshot_id, Enum.max_by(snapshot_events, & &1.sequence)}
      end)

    not Enum.any?(events, &(&1.type == :fork and is_nil(&1.source_snapshot_id))) and
      Enum.any?(events, &(&1.after_snapshot_id == publish.after_snapshot_id)) and
      Enum.all?(events, fn event ->
        previous_complete? =
          is_nil(event.previous_event_id) or
            event.before_snapshot_id == publish.before_snapshot_id or
            MapSet.member?(ids, event.previous_event_id)

        source_complete? =
          is_nil(event.source_snapshot_id) or
            event.source_snapshot_id == publish.before_snapshot_id or
            Map.has_key?(by_snapshot, event.source_snapshot_id)

        before_complete? =
          is_nil(event.before_snapshot_id) or
            event.before_snapshot_id == publish.before_snapshot_id or
            not is_nil(event.previous_event_id) or
            not is_nil(event.source_snapshot_id) or
            Map.has_key?(by_snapshot, event.before_snapshot_id)

        known_origin? =
          event.type == :create and is_nil(event.before_snapshot_id) and
            is_nil(event.previous_event_id) and is_nil(event.source_snapshot_id)

        (previous_complete? and source_complete? and before_complete?) or known_origin?
      end)
  end

  defp paginate_contributors(events, reached_baseline?, cursor, opts) do
    limit = normalize_limit(opts[:limit] || pagi_value(opts[:pagi], :limit))

    contributors =
      events
      |> Enum.filter(&(&1.type in [:create, :edit, :restore]))
      |> Enum.group_by(fn event ->
        if event.actor_type == :user do
          {:user, event.actor_id}
        else
          {:system, event.actor_snapshot}
        end
      end)
      |> Enum.map(fn {_identity, actor_events} ->
        ordered = Enum.sort_by(actor_events, & &1.sequence)
        first = hd(ordered)

        %{
          actor_type: first.actor_type,
          actor_id: first.actor_id,
          actor: first.actor_snapshot,
          event_ids: Enum.map(ordered, & &1.id),
          first_sequence: first.sequence
        }
      end)
      |> Enum.sort_by(& &1.first_sequence, :desc)
      |> then(fn items ->
        if cursor, do: Enum.filter(items, &(&1.first_sequence < cursor)), else: items
      end)

    items = Enum.take(contributors, limit)

    %{
      items: items,
      next_cursor: if(length(contributors) > limit, do: List.last(items).first_sequence),
      unknown: not reached_baseline?
    }
  end

  defp snapshot_ref(%{type: :snapshot, snapshot_id: id} = ref) do
    if Enum.sort(Map.keys(ref)) == [:snapshot_id, :type] do
      cast_uuid(id)
    else
      {:error, :article_history_unavailable}
    end
  end

  defp snapshot_ref(_), do: {:error, :article_history_unavailable}

  defp after_ref(%{type: :snapshot, snapshot_id: id} = ref, article, _actor) do
    if Enum.sort(Map.keys(ref)) == [:snapshot_id, :type] do
      snapshot_version(id, article)
    else
      {:error, :article_history_unavailable}
    end
  end

  defp after_ref(
         %{type: :working_copy, working_copy_id: id, revision: revision} = ref,
         article,
         actor
       ) do
    if Enum.sort(Map.keys(ref)) == [:revision, :type, :working_copy_id] do
      working_copy_ref(id, revision, article, actor)
    else
      {:error, :article_history_unavailable}
    end
  end

  defp after_ref(_version, _article, _actor), do: {:error, :article_history_unavailable}

  defp working_copy_ref(id, revision, article, actor) do
    with {:ok, id} <- cast_uuid(id),
         true <- is_integer(revision) and revision > 0,
         {:ok, :pass} <- authorize(article, actor, CMS.GateAction.article_read_draft()),
         %ArticleWorkingCopy{article_id: article_id} = work <- Repo.get(ArticleWorkingCopy, id),
         true <- article_id == article.id do
      if work.revision == revision do
        {:ok, work}
      else
        {:error, :article_working_copy_revision_conflict}
      end
    else
      _ -> {:error, :article_history_unavailable}
    end
  end

  defp snapshot_version(id, article) do
    with {:ok, id} <- cast_uuid(id),
         %ArticleSnapshot{article_id: article_id} = snapshot <- Repo.get(ArticleSnapshot, id),
         true <- article_id == article.id do
      {:ok, snapshot}
    else
      _ -> {:error, :article_history_unavailable}
    end
  end

  defp cast_uuid(value) do
    case Ecto.UUID.cast(value) do
      {:ok, id} -> {:ok, id}
      :error -> {:error, :article_history_unavailable}
    end
  end

  defp cursor(nil), do: {:ok, nil}
  defp cursor(value) when is_integer(value) and value > 0, do: {:ok, value}

  defp cursor(%{"sequence" => value}) when is_integer(value) and value > 0, do: {:ok, value}
  defp cursor(%{sequence: value}) when is_integer(value) and value > 0, do: {:ok, value}
  defp cursor(_), do: {:error, :article_history_unavailable}

  defp normalize_limit(limit) when is_integer(limit), do: min(max(limit, 1), @max_limit)
  defp normalize_limit(_), do: @default_limit

  defp actor_id_filter(nil), do: {:ok, nil}

  defp actor_id_filter(value) do
    case Integer.parse(to_string(value)) do
      {id, ""} when id > 0 -> {:ok, id}
      _ -> {:error, :article_history_unavailable}
    end
  end

  defp pagi_value(%{key: key, value: value}, field) when key == field, do: value
  defp pagi_value(%{key: key, value: value}, field) when is_atom(key) and key == field, do: value

  defp pagi_value(pagi, field) when is_map(pagi) do
    Map.get(pagi, field) || Map.get(pagi, to_string(field))
  end

  defp pagi_value(_, _), do: nil
end
