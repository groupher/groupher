defmodule GroupherServer.Activity.CommunityLog do
  @moduledoc """
  Reads the Community management surface across all scoped Activity tables.

      audit.read -> normalized filter -> database UNION ALL -> safe projection

  List and stats deliberately share handler selection and filter normalization so
  the dashboard timeline and its overview never count different event sets.
  """

  alias GroupherServer.Activity
  alias GroupherServer.Activity.Event
  alias GroupherServer.Activity.ErrorCat
  alias GroupherServer.Activity.Filter
  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.CMS.Passport.Authorization
  alias GroupherServer.Repo

  @handlers [
    Activity.Post,
    Activity.Blog,
    Activity.Changelog,
    Activity.Doc,
    Activity.Community,
    Activity.DocTree,
    Activity.Press
  ]

  @page_size 30
  @max_export_entries 5_000
  @max_time_window_days 366
  @utc "Etc/UTC"

  @row_fields [
    :log_type,
    :local_id,
    :event_ref,
    :operation_ref,
    :parent_event_ref,
    :action,
    :source,
    :stream_ref,
    :stream_snapshot,
    :subject_type,
    :subject_ref,
    :subject_snapshot,
    :target_type,
    :target_ref,
    :target_snapshot,
    :actor_type,
    :actor_ref,
    :actor_snapshot,
    :on_behalf_of_type,
    :on_behalf_of_ref,
    :on_behalf_of_snapshot,
    :outcome,
    :denial_code,
    :operation_index,
    :record_sequence,
    :changed_fields,
    :payload,
    :metadata,
    :occurred_at,
    :recorded_at
  ]

  @supported_filter_keys [
    :page,
    :resource_type,
    :resource_types,
    :action,
    :actions,
    :categories,
    :outcomes,
    :denial_codes,
    :actor_types,
    :actor_ref,
    :on_behalf_of_ref,
    :subject_ref,
    :target_ref,
    :changed_fields,
    :source,
    :occurred_after,
    :occurred_before,
    :subject_query,
    :event_ref,
    :operation_ref,
    :parent_event_ref
  ]

  @doc "Lists the safe CommunityLog surface with a fixed server-side page size."
  def list(%Community{} = community, actor, selection, page \\ 1) do
    with {:ok, true} <- Authorization.check(actor, "audit.read", %{community: community}),
         {:ok, resolved} <- Filter.resolve(selection, active_actions()),
         {:ok, normalized} <- normalize_filter(Map.put(resolved.filter, :page, page), :list) do
      {total_count, entries} =
        if resolved.empty? do
          {0, []}
        else
          page(select_handlers(normalized), community.id, normalized)
        end

      {:ok,
       %{
         entries: entries,
         total_count: total_count,
         total_pages: max(ceil(total_count / @page_size), 1),
         page_number: normalized.page,
         page_size: @page_size,
         query_context: resolved.query_context
       }}
    end
  end

  @doc "Returns UTC daily counts for the same safe CommunityLog filter as list/3."
  def stats(%Community{} = community, actor, selection) do
    with {:ok, true} <- Authorization.check(actor, "audit.read", %{community: community}),
         {:ok, resolved} <- Filter.resolve(selection, active_actions()),
         {:ok, normalized} <- normalize_filter(resolved.filter, :stats) do
      {total_count, counts} =
        if resolved.empty?,
          do: {0, %{}},
          else: daily_counts(select_handlers(normalized), community.id, normalized)

      {:ok,
       %{
         granularity: :day,
         timezone: @utc,
         total_count: total_count,
         buckets: fill_buckets(normalized.occurred_after, normalized.occurred_before, counts),
         query_context: resolved.query_context
       }}
    end
  end

  @doc "Returns the active CommunityLog action configuration for filter controls."
  def config(%Community{} = community, actor) do
    with {:ok, true} <- Authorization.check(actor, "audit.read", %{community: community}) do
      resources =
        Enum.map(@handlers, fn handler ->
          actions =
            Enum.map(handler.surface_actions(:community_log), fn action ->
              classification = Event.classification(action)

              %{
                action: action,
                category: classification.category,
                high_risk: classification.high_risk,
                message_key: Event.presentation(action).message_key
              }
            end)

          %{resource_type: handler.resource_type(), actions: actions}
        end)

      {:ok,
       %{
         resources: resources,
         sources: Activity.Const.source_values(),
         actor_types: Activity.Const.actor_type_values(),
         presets: Filter.descriptors()
       }}
    end
  end

  @doc "Exports the current CommunityLog filter as bounded JSON or CSV data."
  def export_logs(%Community{} = community, actor, selection, format)
      when format in [:json, :csv] do
    with {:ok, true} <- Authorization.check(actor, "audit.read", %{community: community}),
         {:ok, resolved} <- Filter.resolve(selection, active_actions()),
         {:ok, normalized} <- normalize_filter(Map.put(resolved.filter, :page, 1), :list) do
      {total_count, entries} =
        if resolved.empty? do
          {0, []}
        else
          page(select_handlers(normalized), community.id, normalized, @max_export_entries)
        end

      manifest = export_manifest(community, actor, resolved.query_context, length(entries))
      content = encode_export(entries, format, manifest)

      with {:ok, _audit_event} <-
             Activity.log(community, :activity_exported,
               actor: actor,
               payload: %{
                 format: format,
                 query_context: resolved.query_context,
                 exported_count: length(entries),
                 manifest: manifest
               }
             ) do
        {:ok,
         %{
           content: content,
           filename: "community-activity.#{format}",
           mime_type: if(format == :json, do: "application/json", else: "text/csv"),
           total_count: total_count,
           exported_count: length(entries),
           manifest: manifest,
           query_context: resolved.query_context
         }}
      end
    end
  end

  def export_logs(_community, _actor, _filter, _format),
    do: {:error, ErrorCat.invalid_pagination()}

  @doc "Reads one safe CommunityLog event by its public event reference."
  def get_event(%Community{} = community, actor, event_ref) do
    case list(community, actor, %{filter: %{event_ref: event_ref}}, 1) do
      {:ok, %{entries: [entry | _]}} -> {:ok, entry}
      {:ok, _empty} -> {:ok, nil}
      error -> error
    end
  end

  @doc "Reads one event together with its safe parent and child projections."
  def get_event_detail(%Community{} = community, actor, event_ref) do
    with {:ok, event} <- get_event(community, actor, event_ref),
         {:ok, parent_event} <- related_event(community, actor, event && event.parent_event_ref),
         {:ok, child_result} <- related_children(community, actor, event && event.event_ref) do
      {:ok,
       if event do
         Map.merge(event, %{
           parent_event: parent_event,
           child_events: child_result.entries
         })
       end}
    end
  end

  defp related_event(_community, _actor, nil), do: {:ok, nil}

  defp related_event(community, actor, event_ref),
    do: get_event(community, actor, event_ref)

  defp related_children(_community, _actor, nil), do: {:ok, %{entries: []}}

  defp related_children(community, actor, event_ref),
    do: list(community, actor, %{filter: %{parent_event_ref: event_ref}}, 1)

  def handlers, do: @handlers

  defp active_actions do
    Enum.flat_map(@handlers, fn handler ->
      Enum.map(handler.surface_actions(:community_log), fn action ->
        contract = handler.contracts()[action]

        active_outcomes =
          contract.outcomes
          |> Enum.filter(fn {_outcome, config} -> config.producer_status == :active end)
          |> Enum.map(&elem(&1, 0))

        denial_codes =
          contract.outcomes
          |> Map.get(:denied, %{})
          |> Map.get(:denial_codes, [])

        Map.merge(Event.classification(action), %{
          action: action,
          resource_type: handler.resource_type(),
          outcomes: active_outcomes,
          denial_codes: denial_codes,
          changed_fields: contract.write.accepted_changed_fields
        })
      end)
    end)
  end

  defp page([], _community_id, _filter, _page_size), do: {0, []}

  defp page(handlers, community_id, filter, page_size) do
    {where_sql, params} = where_spec(filter)
    union = Enum.map_join(handlers, " UNION ALL ", &select_sql(&1, where_sql))
    limit_param = length(params) + 2
    offset_param = limit_param + 1

    count_sql = "SELECT count(*) FROM (#{union}) AS activity_rows"

    page_sql = """
    SELECT *
    FROM (#{union}) AS activity_rows
    ORDER BY occurred_at DESC, record_sequence DESC
    LIMIT $#{limit_param} OFFSET $#{offset_param}
    """

    %{rows: [[total_count]]} = Repo.query!(count_sql, [community_id | params])

    %{rows: rows} =
      Repo.query!(
        page_sql,
        [community_id | params] ++ [page_size, (filter.page - 1) * page_size]
      )

    handler_by_type = Map.new(handlers, &{Atom.to_string(&1.resource_type()), &1})

    entries =
      Enum.map(rows, fn row ->
        attrs = Map.new(Enum.zip(@row_fields, row))
        handler = Map.fetch!(handler_by_type, attrs.log_type)
        log = to_log(handler, attrs)
        {:ok, projected} = handler.project(log, :community_log)
        projected
      end)

    {total_count, entries}
  end

  defp page(handlers, community_id, filter),
    do: page(handlers, community_id, filter, @page_size)

  defp daily_counts([], _community_id, _filter), do: {0, %{}}

  defp daily_counts(handlers, community_id, filter) do
    {where_sql, params} = where_spec(filter)
    union = Enum.map_join(handlers, " UNION ALL ", &select_occurred_at_sql(&1, where_sql))

    sql = """
    SELECT date_trunc('day', occurred_at AT TIME ZONE 'UTC') AS bucket_start,
           count(*) AS event_count
    FROM (#{union}) AS activity_rows
    GROUP BY bucket_start
    ORDER BY bucket_start ASC
    """

    %{rows: rows} = Repo.query!(sql, [community_id | params])

    counts =
      Map.new(rows, fn [bucket_start, count] ->
        {DateTime.to_date(DateTime.from_naive!(bucket_start, @utc)), count}
      end)

    {Enum.sum(Map.values(counts)), counts}
  end

  defp select_sql(handler, where_sql) do
    schema = handler.schema()
    table = schema.__schema__(:source)
    prefix = schema.__schema__(:prefix)
    stream_field = handler.stream_field()
    actions = Enum.map_join(handler.surface_actions(:community_log), ", ", &"'#{&1}'")

    """
    SELECT '#{handler.resource_type()}' AS log_type,
           id AS local_id,
           event_ref,
           operation_ref,
           parent_event_ref,
           action,
           source,
           #{stream_field} AS stream_ref,
           stream_snapshot,
           subject_type,
           subject_ref,
           subject_snapshot,
           target_type,
           target_ref,
           target_snapshot,
           actor_type,
           actor_ref,
           actor_snapshot,
           on_behalf_of_type,
           on_behalf_of_ref,
           on_behalf_of_snapshot,
           outcome,
           denial_code,
           operation_index,
           record_sequence,
           changed_fields,
           payload,
           metadata,
           occurred_at,
           recorded_at
    FROM #{prefix}.#{table}
    WHERE community_id = $1
      AND action IN (#{actions})#{where_sql}
    """
  end

  defp select_occurred_at_sql(handler, where_sql) do
    schema = handler.schema()
    table = schema.__schema__(:source)
    prefix = schema.__schema__(:prefix)
    actions = Enum.map_join(handler.surface_actions(:community_log), ", ", &"'#{&1}'")

    """
    SELECT occurred_at
    FROM #{prefix}.#{table}
    WHERE community_id = $1
      AND action IN (#{actions})#{where_sql}
    """
  end

  defp to_log(handler, attrs) do
    log_attrs = %{
      id: attrs.local_id,
      event_ref: attrs.event_ref,
      operation_ref: attrs.operation_ref,
      parent_event_ref: attrs.parent_event_ref,
      action: String.to_existing_atom(attrs.action),
      source: String.to_existing_atom(attrs.source),
      stream_snapshot: attrs.stream_snapshot,
      subject_type: attrs.subject_type,
      subject_ref: attrs.subject_ref,
      subject_snapshot: attrs.subject_snapshot,
      target_type: attrs.target_type,
      target_ref: attrs.target_ref,
      target_snapshot: attrs.target_snapshot,
      actor_type: String.to_existing_atom(attrs.actor_type),
      actor_ref: attrs.actor_ref,
      actor_snapshot: attrs.actor_snapshot,
      on_behalf_of_type: optional_existing_atom(attrs.on_behalf_of_type),
      on_behalf_of_ref: attrs.on_behalf_of_ref,
      on_behalf_of_snapshot: attrs.on_behalf_of_snapshot,
      outcome: String.to_existing_atom(attrs.outcome),
      denial_code: attrs.denial_code,
      operation_index: attrs.operation_index,
      record_sequence: attrs.record_sequence,
      changed_fields: attrs.changed_fields,
      payload: attrs.payload,
      metadata: attrs.metadata,
      occurred_at: attrs.occurred_at,
      recorded_at: attrs.recorded_at
    }

    struct(handler.schema(), Map.put(log_attrs, handler.stream_field(), attrs.stream_ref))
  end

  defp select_handlers(%{resource_types: nil, actions: nil}), do: @handlers

  defp select_handlers(%{resource_types: resource_types, actions: actions}) do
    @handlers
    |> filter_handlers(resource_types)
    |> Enum.filter(fn handler ->
      case actions do
        nil -> true
        actions -> Enum.any?(actions, &(&1 in handler.surface_actions(:community_log)))
      end
    end)
  end

  defp filter_handlers(handlers, nil), do: handlers

  defp filter_handlers(handlers, resource_types) do
    Enum.filter(handlers, &(to_string(&1.resource_type()) in resource_types))
  end

  defp normalize_filter(filter, mode) when is_map(filter) do
    with :ok <- validate_filter_keys(filter),
         {:ok, page} <- positive_page(Map.get(filter, :page, 1)),
         {:ok, resource_types} <- normalize_resource_types(filter),
         {:ok, actions} <- normalize_actions(filter),
         {:ok, categories} <- normalize_categories(filter),
         {:ok, outcomes} <-
           normalize_enum_list(Map.get(filter, :outcomes), Activity.Const.outcome_values()),
         {:ok, actor_types} <-
           normalize_enum_list(Map.get(filter, :actor_types), Activity.Const.actor_type_values()),
         {:ok, denial_codes} <-
           normalize_declared_text_list(Map.get(filter, :denial_codes), declared_denial_codes()),
         {:ok, changed_fields} <-
           normalize_declared_text_list(
             Map.get(filter, :changed_fields),
             declared_changed_fields()
           ),
         {:ok, source} <- normalize_source(Map.get(filter, :source)),
         {:ok, occurred_after} <- normalize_datetime(Map.get(filter, :occurred_after)),
         {:ok, occurred_before} <- normalize_datetime(Map.get(filter, :occurred_before)),
         :ok <- validate_time_window(mode, occurred_after, occurred_before),
         {:ok, event_ref} <- normalize_uuid(Map.get(filter, :event_ref)),
         {:ok, operation_ref} <- normalize_uuid(Map.get(filter, :operation_ref)),
         {:ok, parent_event_ref} <- normalize_uuid(Map.get(filter, :parent_event_ref)) do
      actions = merge_action_filters(actions, categories)
      subject_title_search = title_search_allowed?(actions)

      {:ok,
       %{
         page: page,
         resource_types: resource_types,
         actions: actions,
         categories: categories,
         outcomes: outcomes,
         denial_codes: denial_codes,
         actor_types: actor_types,
         actor_ref: normalize_text(Map.get(filter, :actor_ref)),
         on_behalf_of_ref: normalize_text(Map.get(filter, :on_behalf_of_ref)),
         subject_ref: normalize_text(Map.get(filter, :subject_ref)),
         target_ref: normalize_text(Map.get(filter, :target_ref)),
         changed_fields: changed_fields,
         source: source,
         occurred_after: occurred_after,
         occurred_before: occurred_before,
         subject_query: normalize_text(Map.get(filter, :subject_query)),
         subject_title_search: subject_title_search,
         event_ref: event_ref,
         operation_ref: operation_ref,
         parent_event_ref: parent_event_ref
       }}
    end
  end

  defp normalize_filter(_filter, _mode), do: {:error, ErrorCat.invalid_pagination()}

  defp validate_filter_keys(filter) do
    if Map.keys(filter) -- @supported_filter_keys == [],
      do: :ok,
      else: {:error, ErrorCat.invalid_pagination()}
  end

  defp positive_page(page) when is_integer(page) and page > 0, do: {:ok, page}
  defp positive_page(_), do: {:error, ErrorCat.invalid_pagination()}

  defp normalize_resource_types(filter) do
    value = Map.get(filter, :resource_types, Map.get(filter, :resource_type))
    known = Enum.map(@handlers, &to_string(&1.resource_type()))

    case value do
      nil ->
        {:ok, nil}

      value ->
        values = list_value(value)

        if Enum.all?(values, &(&1 in known)),
          do: {:ok, values},
          else: {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp normalize_actions(filter) do
    value = Map.get(filter, :actions, Map.get(filter, :action))

    if is_nil(value) do
      {:ok, nil}
    else
      values = list_value(value)
      actions = Enum.map(values, &safe_existing_atom/1)
      visible = @handlers |> Enum.flat_map(& &1.surface_actions(:community_log)) |> MapSet.new()

      if Enum.all?(actions, &(&1 in visible)),
        do: {:ok, actions},
        else: {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp normalize_categories(filter) do
    value = Map.get(filter, :categories)

    if is_nil(value) do
      {:ok, nil}
    else
      categories = Enum.map(list_value(value), &safe_existing_atom/1)
      known = [:content, :publishing, :lifecycle, :engagement, :moderation, :community]

      if Enum.all?(categories, &(&1 in known)),
        do: {:ok, categories},
        else: {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp merge_action_filters(nil, nil), do: nil
  defp merge_action_filters(actions, nil), do: actions
  defp merge_action_filters(nil, categories), do: visible_actions(%{categories: categories})

  defp merge_action_filters(actions, categories) do
    allowed = MapSet.new(visible_actions(%{categories: categories}))
    Enum.filter(actions, &MapSet.member?(allowed, &1))
  end

  defp normalize_enum_list(nil, _known), do: {:ok, nil}

  defp normalize_enum_list(value, known) do
    values = Enum.map(list_value(value), &safe_existing_atom/1)

    if Enum.all?(values, &(&1 in known)),
      do: {:ok, values},
      else: {:error, ErrorCat.invalid_pagination()}
  end

  defp normalize_declared_text_list(nil, _known), do: {:ok, nil}

  defp normalize_declared_text_list(value, known) do
    values = list_value(value) |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))

    if values != [] and Enum.all?(values, &(&1 in known)),
      do: {:ok, Enum.uniq(values)},
      else: {:error, ErrorCat.invalid_pagination()}
  end

  defp normalize_source(nil), do: {:ok, nil}

  defp normalize_source(source) do
    source = if is_binary(source), do: safe_existing_atom(source), else: source

    if source in GroupherServer.Activity.Const.source_values(),
      do: {:ok, source},
      else: {:error, ErrorCat.invalid_pagination()}
  end

  defp normalize_datetime(nil), do: {:ok, nil}

  defp normalize_datetime(%DateTime{} = datetime),
    do: {:ok, DateTime.shift_zone!(datetime, @utc)}

  defp normalize_datetime(_), do: {:error, ErrorCat.invalid_pagination()}

  defp validate_time_window(:list, nil, nil), do: :ok

  defp validate_time_window(:stats, nil, nil), do: {:error, ErrorCat.invalid_pagination()}

  defp validate_time_window(_mode, %DateTime{} = occurred_after, %DateTime{} = occurred_before) do
    seconds = DateTime.diff(occurred_before, occurred_after)

    if seconds > 0 and seconds <= @max_time_window_days * 86_400,
      do: :ok,
      else: {:error, ErrorCat.invalid_pagination()}
  end

  defp validate_time_window(_mode, _after, _before), do: {:error, ErrorCat.invalid_pagination()}

  defp normalize_uuid(nil), do: {:ok, nil}

  defp normalize_uuid(value) when is_binary(value) do
    case Ecto.UUID.cast(value) do
      {:ok, uuid} -> Ecto.UUID.dump(uuid)
      :error -> {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp normalize_uuid(_), do: {:error, ErrorCat.invalid_pagination()}

  defp where_spec(filter) do
    {conditions, params, next} = {[], [], 2}
    {conditions, params, next} = add_array_condition(conditions, params, next, filter.actions)

    {conditions, params, next} =
      add_text_array_condition(conditions, params, next, filter.outcomes, "outcome")

    {conditions, params, next} =
      add_text_array_condition(conditions, params, next, filter.denial_codes, "denial_code")

    {conditions, params, next} =
      add_text_array_condition(conditions, params, next, filter.actor_types, "actor_type")

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.actor_ref, "actor_ref = $%d")

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.on_behalf_of_ref, "on_behalf_of_ref = $%d")

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.subject_ref, "subject_ref = $%d")

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.target_ref, "target_ref = $%d")

    {conditions, params, next} =
      case filter.changed_fields do
        nil ->
          {conditions, params, next}

        fields ->
          {[" AND changed_fields @> $#{next}::text[]" | conditions], [fields | params], next + 1}
      end

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.source, "source = $%d")

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.occurred_after, "occurred_at >= $%d")

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.occurred_before, "occurred_at < $%d")

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.event_ref, "event_ref = $%d::uuid")

    {conditions, params, next} =
      case filter.subject_query do
        nil ->
          {conditions, params, next}

        query ->
          if filter.subject_title_search do
            {
              [
                " AND (subject_ref = $#{next} OR subject_snapshot->>'title' ILIKE $#{next + 1})"
                | conditions
              ],
              ["%#{query}%", query | params],
              next + 2
            }
          else
            {
              [" AND subject_ref = $#{next}" | conditions],
              [query | params],
              next + 1
            }
          end
      end

    {conditions, params, next} =
      add_condition(conditions, params, next, filter.operation_ref, "operation_ref = $%d::uuid")

    {conditions, params, _next} =
      add_condition(
        conditions,
        params,
        next,
        filter.parent_event_ref,
        "parent_event_ref = $%d::uuid"
      )

    {Enum.join(Enum.reverse(conditions)), Enum.reverse(params)}
  end

  defp visible_actions(%{categories: categories}) do
    @handlers
    |> Enum.flat_map(fn handler ->
      Enum.filter(handler.surface_actions(:community_log), fn action ->
        Event.classification(action).category in categories
      end)
    end)
    |> Enum.uniq()
  end

  defp declared_denial_codes do
    @handlers
    |> Enum.flat_map(fn handler ->
      Enum.flat_map(handler.contracts(), fn {_action, contract} ->
        contract.outcomes
        |> Map.get(:denied, %{})
        |> Map.get(:denial_codes, [])
      end)
    end)
    |> Enum.map(&to_string/1)
    |> Enum.uniq()
  end

  defp declared_changed_fields do
    @handlers
    |> Enum.flat_map(fn handler ->
      Enum.flat_map(handler.contracts(), fn {_action, contract} ->
        contract.write.accepted_changed_fields
      end)
    end)
    |> Enum.map(&to_string/1)
    |> Enum.uniq()
  end

  defp title_search_allowed?(actions) do
    @handlers
    |> Enum.flat_map(fn handler ->
      handler.contracts()
      |> Enum.filter(fn {action, contract} ->
        (is_nil(actions) or action in actions) and
          contract.producer_status == :active and
          Map.has_key?(contract.surfaces, :community_log)
      end)
      |> Enum.map(fn {_action, contract} ->
        :subject_snapshot_title in contract.subject_search
      end)
    end)
    |> Enum.all?()
  end

  defp add_array_condition(conditions, params, next, nil), do: {conditions, params, next}

  defp add_array_condition(conditions, params, next, actions),
    do:
      {[" AND action = ANY($#{next}::text[])" | conditions],
       [Enum.map(actions, &to_string/1) | params], next + 1}

  defp add_text_array_condition(conditions, params, next, nil, _field),
    do: {conditions, params, next}

  defp add_text_array_condition(conditions, params, next, values, field),
    do:
      {[" AND #{field} = ANY($#{next}::text[])" | conditions],
       [Enum.map(values, &to_string/1) | params], next + 1}

  defp add_condition(conditions, params, next, nil, _template), do: {conditions, params, next}

  defp add_condition(conditions, params, next, value, template) do
    condition = String.replace(template, "%d", Integer.to_string(next))
    {[" AND " <> condition | conditions], [value | params], next + 1}
  end

  defp fill_buckets(after_datetime, before_datetime, counts) do
    first_date = DateTime.to_date(after_datetime)
    last_date = DateTime.to_date(DateTime.add(before_datetime, -1, :microsecond))

    Date.range(first_date, last_date)
    |> Enum.map(fn date ->
      started_at = DateTime.new!(date, ~T[00:00:00], @utc)
      ended_at = DateTime.add(started_at, 86_400, :second)

      %{started_at: started_at, ended_at: ended_at, count: Map.get(counts, date, 0)}
    end)
  end

  defp encode_export(entries, :json, manifest),
    do: Jason.encode!(%{manifest: manifest, entries: entries})

  defp encode_export(entries, :csv, _manifest) do
    header =
      ~w(event_ref operation_ref parent_event_ref operation_index record_sequence action outcome denial_code changed_fields category high_risk resource_type resource_ref actor_type actor_ref subject_ref source occurred_at recorded_at)

    rows =
      Enum.map(entries, fn entry ->
        [
          entry.event_ref,
          entry.operation_ref,
          entry.parent_event_ref,
          entry.operation_index,
          entry.record_sequence,
          entry.action,
          entry.outcome,
          entry.denial_code,
          Enum.join(entry.changed_fields, "|"),
          entry.category,
          entry.high_risk,
          entry.resource.type,
          entry.resource.ref,
          entry.actor.type,
          Map.get(entry.actor, :id) || Map.get(entry.actor, :login) || entry.actor.type,
          entry.subject.ref,
          entry.source,
          entry.occurred_at,
          entry.recorded_at
        ]
      end)

    [header | rows]
    |> Enum.map_join("\n", fn row -> Enum.map_join(row, ",", &csv_cell/1) end)
  end

  defp csv_cell(nil), do: ""

  defp csv_cell(value) do
    value = to_string(value)

    if String.contains?(value, [",", "\"", "\n"]),
      do: "\"#{String.replace(value, "\"", "\"\"")}\"",
      else: value
  end

  defp list_value(value) when is_list(value), do: Enum.map(value, &to_string/1)
  defp list_value(value), do: [to_string(value)]

  defp normalize_text(nil), do: nil
  defp normalize_text(value) when is_binary(value), do: value |> String.trim() |> empty_to_nil()
  defp normalize_text(value), do: value |> to_string() |> normalize_text()

  defp empty_to_nil(""), do: nil
  defp empty_to_nil(value), do: value

  defp safe_existing_atom(value) do
    String.to_existing_atom(value)
  rescue
    ArgumentError -> nil
  end

  defp optional_existing_atom(nil), do: nil
  defp optional_existing_atom(value), do: String.to_existing_atom(value)

  defp export_manifest(community, actor, query_context, count) do
    %{
      schema_version: 3,
      generated_at: DateTime.utc_now(:second),
      generated_by: Event.actor_attrs(actor).actor_ref,
      community_ref: community.slug,
      query_context: query_context,
      event_count: count,
      timezone: @utc
    }
  end
end
