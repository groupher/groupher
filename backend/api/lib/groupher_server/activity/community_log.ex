defmodule GroupherServer.Activity.CommunityLog do
  @moduledoc """
  Reads the Community management surface across all scoped Activity tables.

      audit.read -> normalized filter -> database UNION ALL -> safe projection

  List and stats deliberately share handler selection and filter normalization so
  the dashboard timeline and its overview never count different event sets.

  Ecto UNION rows are the shared read base for Pagi, aggregates and bounded exports.
  """

  import Ecto.Query

  alias GroupherServer.{Activity, CMS, Repo}
  alias Activity.{ErrorCat, Event, Filter}
  alias Activity.Model.CommunityTimelineRow
  alias CMS.Model.Community
  alias Helper.ORM
  alias Helper.ORM.Pagi.{Order, Page}

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
  @private_admin_actions ~w(
    admin_joined
    admin_removed
    admin_permissions_changed
    admin_request_created
    admin_request_decided
    admin_request_cancelled
    admin_request_expired
  )

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
    :rejection_code,
    :operation_index,
    :record_sequence,
    :changed_fields,
    :payload,
    :metadata,
    :occurred_at,
    :recorded_at
  ]

  @supported_filter_keys [
    :resource_type,
    :resource_types,
    :action,
    :actions,
    :categories,
    :outcomes,
    :rejection_codes,
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

  @doc """
  Lists authorized CommunityLog rows under the selected filter and Pagi position.

  ## Examples

      Activity.CommunityLog.list(community, actor, %{filter: %{actions: [:create]}}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  def list(%Community{} = community, actor, selection, pagi \\ nil) do
    with {:ok, visibility} <-
           authorize_audit_read(actor, community),
         {:ok, resolved} <- Filter.resolve(selection, active_actions()),
         {:ok, normalized} <- normalize_filter(resolved.filter, :list),
         handlers <- if(resolved.empty?, do: [], else: select_handlers(normalized)),
         {:ok, page} <-
           ORM.pagi(scoped_rows(handlers, community.id, normalized, visibility), pagi,
             for: CommunityTimelineRow,
             order: order(),
             surface: "activity.community",
             query_fingerprint:
               :crypto.hash(:sha256, :erlang.term_to_binary({community.id, normalized}))
               |> Base.encode16()
           ) do
      {:ok,
       %{
         entries: project_rows(page.entries),
         page_info: Page.info(page),
         query_context: resolved.query_context
       }}
    end
  end

  @doc """
  Returns UTC daily counts for the same safe CommunityLog filter as list/3.

  ## Examples

      Activity.CommunityLog.stats(community, actor, %{filter: %{outcomes: [:denied]}})
  """
  def stats(%Community{} = community, actor, selection) do
    with {:ok, visibility} <-
           authorize_audit_read(actor, community),
         {:ok, resolved} <- Filter.resolve(selection, active_actions()),
         {:ok, normalized} <- normalize_filter(resolved.filter, :stats) do
      {total_count, counts} =
        if resolved.empty? do
          {0, %{}}
        else
          daily_counts(select_handlers(normalized), community.id, normalized, visibility)
        end

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

  @doc """
  Returns the active CommunityLog action configuration for filter controls.

  ## Examples

      Activity.CommunityLog.config(community, actor)
  """
  def config(%Community{} = community, actor) do
    with {:ok, _visibility} <- authorize_audit_read(actor, community) do
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

  @doc """
  Exports the current CommunityLog filter as bounded JSON or CSV data.

  ## Examples

      Activity.CommunityLog.export_logs(community, actor, %{filter: %{}}, :json)
  """
  def export_logs(%Community{} = community, actor, selection, format)
      when format in [:json, :csv] do
    with {:ok, visibility} <-
           authorize_audit_read(actor, community),
         {:ok, resolved} <- Filter.resolve(selection, active_actions()),
         {:ok, normalized} <- normalize_filter(resolved.filter, :list) do
      {total_count, entries} =
        if resolved.empty? do
          {0, []}
        else
          export_rows(select_handlers(normalized), community.id, normalized, visibility)
        end

      manifest = export_manifest(community, actor, resolved.query_context, length(entries))
      content = encode_export(entries, format, manifest)

      with {:ok, _audit_event} <-
             Activity.Workflow.log(community, :activity_exported,
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

  def export_logs(_community, _actor, _filter, _format) do
    {:error, ErrorCat.invalid_pagination()}
  end

  @doc """
  Reads one safe CommunityLog event by its public event reference.

  ## Examples

      Activity.CommunityLog.get_event(community, actor, event_ref)
  """
  def get_event(%Community{} = community, actor, event_ref) do
    with {:ok, visibility} <- authorize_audit_read(actor, community) do
      get_event_with_visibility(community, event_ref, visibility)
    end
  end

  @doc """
  Reads one event together with its safe parent and child projections.

  ## Examples

      Activity.CommunityLog.get_event_detail(community, actor, event_ref)
  """
  def get_event_detail(%Community{} = community, actor, event_ref) do
    with {:ok, visibility} <- authorize_audit_read(actor, community),
         {:ok, event} <- get_event_with_visibility(community, event_ref, visibility),
         {:ok, parent_event} <-
           related_event(community, event && event.parent_event_ref, visibility),
         {:ok, child_result} <- related_children(community, event && event.event_ref, visibility) do
      {:ok,
       if event do
         Map.merge(event, %{
           parent_event: parent_event,
           child_events: child_result.entries
         })
       end}
    end
  end

  defp authorize_audit_read(actor, community) do
    with {:ok, scope} <- CMS.passport_community_scope(actor, community),
         {:ok, true} <- CMS.passport_allowed?(actor, scope, "audit.read") do
      {:ok, %{private_admin_events?: scope.global.is_root or scope.community.is_lord}}
    else
      _ -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end

  defp related_event(_community, nil, _visibility), do: {:ok, nil}

  defp related_event(community, event_ref, visibility) do
    get_event_with_visibility(community, event_ref, visibility)
  end

  defp related_children(_community, nil, _visibility), do: {:ok, %{entries: []}}

  defp related_children(community, event_ref, visibility) do
    with {:ok, entries} <-
           bounded_entries(
             community.id,
             %{filter: %{parent_event_ref: event_ref}},
             @page_size,
             visibility
           ) do
      {:ok, %{entries: entries}}
    end
  end

  defp get_event_with_visibility(community, event_ref, visibility) do
    with {:ok, entries} <-
           bounded_entries(
             community.id,
             %{filter: %{event_ref: event_ref}},
             1,
             visibility
           ) do
      {:ok, List.first(entries)}
    end
  end

  @doc """
  Returns the closed set of handlers used by the CommunityLog reader.

  ## Examples

      Activity.CommunityLog.handlers()
  """
  def handlers, do: @handlers

  defp active_actions do
    Enum.flat_map(@handlers, fn handler ->
      Enum.map(handler.surface_actions(:community_log), fn action ->
        contract = handler.contracts()[action]

        active_outcomes =
          contract.outcomes
          |> Enum.filter(fn {_outcome, config} -> config.producer_status == :active end)
          |> Enum.map(&elem(&1, 0))

        rejection_codes =
          contract.outcomes
          |> Map.get(:denied, %{})
          |> Map.get(:rejection_codes, [])

        Map.merge(Event.classification(action), %{
          action: action,
          resource_type: handler.resource_type(),
          outcomes: active_outcomes,
          rejection_codes: rejection_codes,
          changed_fields: contract.write.accepted_changed_fields
        })
      end)
    end)
  end

  defp order do
    %Order{
      fields: [:occurred_at, :record_sequence],
      directions: [:desc, :desc],
      cursor_fields: [:occurred_at, :record_sequence]
    }
  end

  defp bounded_entries(community_id, selection, limit, visibility) do
    with {:ok, resolved} <- Filter.resolve(selection, active_actions()),
         {:ok, normalized} <- normalize_filter(resolved.filter, :list) do
      handlers = if resolved.empty?, do: [], else: select_handlers(normalized)

      entries =
        scoped_rows(handlers, community_id, normalized, visibility)
        |> order_by([row], desc: row.occurred_at, desc: row.record_sequence)
        |> limit(^limit)
        |> Repo.all()
        |> project_rows()

      {:ok, entries}
    end
  end

  defp export_rows(handlers, community_id, filter, visibility) do
    query = scoped_rows(handlers, community_id, filter, visibility)
    count = Repo.aggregate(query, :count)

    entries =
      query
      |> order_by([row], desc: row.occurred_at, desc: row.record_sequence)
      |> limit(@max_export_entries)
      |> Repo.all()
      |> project_rows()

    {count, entries}
  end

  defp daily_counts(handlers, community_id, filter, visibility) do
    counts =
      scoped_rows(handlers, community_id, filter, visibility)
      |> group_by([row], type(fragment("(? AT TIME ZONE 'UTC')::date", row.occurred_at), :date))
      |> select(
        [row],
        {type(fragment("(? AT TIME ZONE 'UTC')::date", row.occurred_at), :date),
         count(row.record_sequence)}
      )
      |> Repo.all()
      |> Map.new()

    {Enum.sum(Map.values(counts)), counts}
  end

  defp scoped_rows(handlers, community_id, filter, visibility) do
    queries = Enum.map(handlers, &handler_rows(&1, community_id))

    query =
      case queries do
        [] ->
          handler_rows(hd(@handlers), community_id) |> where(false)

        [first | rest] ->
          Enum.reduce(rest, first, fn query, union -> union_all(union, ^query) end)
      end

    query = from(row in subquery(query)) |> filter_rows(filter)

    if visibility.private_admin_events? do
      query
    else
      where(query, [row], row.action not in ^@private_admin_actions)
    end
  end

  defp handler_rows(handler, community_id) do
    resource_type = to_string(handler.resource_type())
    stream_field = handler.stream_field()
    actions = handler.surface_actions(:community_log)

    projection =
      Map.new(@row_fields, fn
        :log_type ->
          {:log_type, dynamic([], type(^resource_type, :string))}

        :local_id ->
          {:local_id, dynamic([log], log.id)}

        :stream_ref ->
          {:stream_ref, dynamic([log], fragment("?::text", field(log, ^stream_field)))}

        key when key in [:action, :source, :actor_type, :on_behalf_of_type, :outcome] ->
          {key, dynamic([log], type(field(log, ^key), :string))}

        key ->
          {key, dynamic([log], field(log, ^key))}
      end)

    from(log in handler.schema(),
      where: log.community_id == ^community_id and log.action in ^actions,
      select: ^projection
    )
  end

  defp filter_rows(query, filter) do
    query =
      Enum.reduce(
        [
          actions: :action,
          outcomes: :outcome,
          rejection_codes: :rejection_code,
          actor_types: :actor_type
        ],
        query,
        fn {key, field_name}, query ->
          case Map.fetch!(filter, key) do
            nil ->
              query

            values ->
              values = Enum.map(values, &to_string/1)
              where(query, [row], field(row, ^field_name) in ^values)
          end
        end
      )

    query =
      Enum.reduce(
        [
          :actor_ref,
          :on_behalf_of_ref,
          :subject_ref,
          :target_ref,
          :event_ref,
          :operation_ref,
          :parent_event_ref
        ],
        query,
        fn key, query ->
          case Map.fetch!(filter, key) do
            nil -> query
            value -> where(query, [row], field(row, ^key) == ^value)
          end
        end
      )

    query =
      if filter.source do
        where(query, [row], row.source == ^to_string(filter.source))
      else
        query
      end

    query =
      if filter.occurred_after do
        where(query, [row], row.occurred_at >= ^filter.occurred_after)
      else
        query
      end

    query =
      if filter.occurred_before do
        where(query, [row], row.occurred_at < ^filter.occurred_before)
      else
        query
      end

    query =
      if filter.changed_fields do
        where(
          query,
          [row],
          fragment("? @> ?::text[]", row.changed_fields, ^filter.changed_fields)
        )
      else
        query
      end

    case filter.subject_query do
      nil ->
        query

      search ->
        if filter.subject_title_search do
          where(
            query,
            [row],
            row.subject_ref == ^search or
              ilike(fragment("?->>'title'", row.subject_snapshot), ^"%#{search}%")
          )
        else
          where(query, [row], row.subject_ref == ^search)
        end
    end
  end

  defp project_rows(rows) do
    handlers = Map.new(@handlers, &{to_string(&1.resource_type()), &1})

    Enum.map(rows, fn attrs ->
      handler = Map.fetch!(handlers, attrs.log_type)
      {:ok, projected} = handler.project(to_log(handler, attrs), :community_log)
      projected
    end)
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
      rejection_code: attrs.rejection_code,
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
    with {:ok, _} <- validate_filter_keys(filter),
         {:ok, resource_types} <- normalize_resource_types(filter),
         {:ok, actions} <- normalize_actions(filter),
         {:ok, categories} <- normalize_categories(filter),
         {:ok, outcomes} <-
           normalize_enum_list(Map.get(filter, :outcomes), Activity.Const.outcome_values()),
         {:ok, actor_types} <-
           normalize_enum_list(Map.get(filter, :actor_types), Activity.Const.actor_type_values()),
         {:ok, rejection_codes} <-
           normalize_declared_text_list(
             Map.get(filter, :rejection_codes),
             declared_rejection_codes()
           ),
         {:ok, changed_fields} <-
           normalize_declared_text_list(
             Map.get(filter, :changed_fields),
             declared_changed_fields()
           ),
         {:ok, source} <- normalize_source(Map.get(filter, :source)),
         {:ok, occurred_after} <- normalize_datetime(Map.get(filter, :occurred_after)),
         {:ok, occurred_before} <- normalize_datetime(Map.get(filter, :occurred_before)),
         {:ok, _} <- validate_time_window(mode, occurred_after, occurred_before),
         {:ok, event_ref} <- normalize_uuid(Map.get(filter, :event_ref)),
         {:ok, operation_ref} <- normalize_uuid(Map.get(filter, :operation_ref)),
         {:ok, parent_event_ref} <- normalize_uuid(Map.get(filter, :parent_event_ref)) do
      actions = merge_action_filters(actions, categories)
      subject_title_search = title_search_allowed?(actions)

      {:ok,
       %{
         resource_types: resource_types,
         actions: actions,
         categories: categories,
         outcomes: outcomes,
         rejection_codes: rejection_codes,
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
    if Map.keys(filter) -- @supported_filter_keys == [] do
      {:ok, :pass}
    else
      {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp normalize_resource_types(filter) do
    value = Map.get(filter, :resource_types, Map.get(filter, :resource_type))
    known = Enum.map(@handlers, &to_string(&1.resource_type()))

    case value do
      nil ->
        {:ok, nil}

      value ->
        values = list_value(value)

        if Enum.all?(values, &(&1 in known)) do
          {:ok, values}
        else
          {:error, ErrorCat.invalid_pagination()}
        end
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

      if Enum.all?(actions, &(&1 in visible)) do
        {:ok, actions}
      else
        {:error, ErrorCat.invalid_pagination()}
      end
    end
  end

  defp normalize_categories(filter) do
    value = Map.get(filter, :categories)

    if is_nil(value) do
      {:ok, nil}
    else
      categories = Enum.map(list_value(value), &safe_existing_atom/1)
      known = [:content, :publishing, :lifecycle, :engagement, :moderation, :community]

      if Enum.all?(categories, &(&1 in known)) do
        {:ok, categories}
      else
        {:error, ErrorCat.invalid_pagination()}
      end
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

    if Enum.all?(values, &(&1 in known)) do
      {:ok, values}
    else
      {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp normalize_declared_text_list(nil, _known), do: {:ok, nil}

  defp normalize_declared_text_list(value, known) do
    values = list_value(value) |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))

    if values != [] and Enum.all?(values, &(&1 in known)) do
      {:ok, Enum.uniq(values)}
    else
      {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp normalize_source(nil), do: {:ok, nil}

  defp normalize_source(source) do
    source = if is_binary(source), do: safe_existing_atom(source), else: source

    if source in GroupherServer.Activity.Const.source_values() do
      {:ok, source}
    else
      {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp normalize_datetime(nil), do: {:ok, nil}

  defp normalize_datetime(%DateTime{} = datetime) do
    {:ok, DateTime.shift_zone!(datetime, @utc)}
  end

  defp normalize_datetime(_), do: {:error, ErrorCat.invalid_pagination()}

  defp validate_time_window(:list, nil, nil), do: {:ok, :pass}

  defp validate_time_window(:stats, nil, nil), do: {:error, ErrorCat.invalid_pagination()}

  defp validate_time_window(_mode, %DateTime{} = occurred_after, %DateTime{} = occurred_before) do
    seconds = DateTime.diff(occurred_before, occurred_after)

    if seconds > 0 and seconds <= @max_time_window_days * 86_400 do
      {:ok, :pass}
    else
      {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp validate_time_window(_mode, _after, _before), do: {:error, ErrorCat.invalid_pagination()}

  defp normalize_uuid(nil), do: {:ok, nil}

  defp normalize_uuid(value) when is_binary(value) do
    case Ecto.UUID.cast(value) do
      {:ok, uuid} -> {:ok, uuid}
      :error -> {:error, ErrorCat.invalid_pagination()}
    end
  end

  defp normalize_uuid(_), do: {:error, ErrorCat.invalid_pagination()}

  defp visible_actions(%{categories: categories}) do
    @handlers
    |> Enum.flat_map(fn handler ->
      Enum.filter(handler.surface_actions(:community_log), fn action ->
        Event.classification(action).category in categories
      end)
    end)
    |> Enum.uniq()
  end

  defp declared_rejection_codes do
    @handlers
    |> Enum.flat_map(fn handler ->
      Enum.flat_map(handler.contracts(), fn {_action, contract} ->
        contract.outcomes
        |> Map.get(:denied, %{})
        |> Map.get(:rejection_codes, [])
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

  defp encode_export(entries, :json, manifest) do
    Jason.encode!(%{manifest: manifest, entries: entries})
  end

  defp encode_export(entries, :csv, _manifest) do
    header =
      ~w(event_ref operation_ref parent_event_ref operation_index record_sequence action outcome rejection_code changed_fields category high_risk resource_type resource_ref actor_type actor_ref subject_ref source occurred_at recorded_at)

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
          entry.rejection_code,
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

    if String.contains?(value, [",", "\"", "\n"]) do
      "\"#{String.replace(value, "\"", "\"\"")}\""
    else
      value
    end
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
