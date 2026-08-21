defmodule GroupherServer.Activity.CommunityLog do
  @moduledoc """
  Reads the Community management surface across all scoped Activity tables.

      audit.read -> database UNION ALL page -> safe handler projection
  """

  alias GroupherServer.Activity
  alias GroupherServer.Activity.ErrorCat
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

  @row_fields [
    :log_type,
    :local_id,
    :hash_id,
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
    :actor_id,
    :actor_snapshot,
    :payload,
    :metadata,
    :occurred_at
  ]

  def list(%Community{} = community, actor, filter) do
    with {:ok, true} <- Authorization.check(actor, "audit.read", %{community: community}),
         {:ok, page} <- pagination(filter) do
      action = Map.get(filter, :action)

      handlers =
        filter
        |> Map.get(:resource_type)
        |> filter_handlers()
        |> filter_action(action)

      {total_count, entries} = page(handlers, community.id, action, page, @page_size)

      {:ok,
       %{
         entries: entries,
         total_count: total_count,
         total_pages: max(ceil(total_count / @page_size), 1),
         page_number: page,
         page_size: @page_size
       }}
    end
  end

  def handlers, do: @handlers

  defp page([], _community_id, _action, _page, _size), do: {0, []}

  defp page(handlers, community_id, action, page, size) do
    filter_action? = not is_nil(action) and is_atom(action)
    action_sql = if filter_action?, do: " AND action = $2", else: ""
    params = if filter_action?, do: [community_id, Atom.to_string(action)], else: [community_id]
    union = Enum.map_join(handlers, " UNION ALL ", &select_sql(&1, action_sql))
    limit_param = length(params) + 1
    offset_param = limit_param + 1

    count_sql = "SELECT count(*) FROM (#{union}) AS activity_rows"

    page_sql = """
    SELECT *
    FROM (#{union}) AS activity_rows
    ORDER BY occurred_at DESC, log_type ASC, local_id DESC
    LIMIT $#{limit_param} OFFSET $#{offset_param}
    """

    %{rows: [[total_count]]} = Repo.query!(count_sql, params)
    %{rows: rows} = Repo.query!(page_sql, params ++ [size, (page - 1) * size])

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

  defp select_sql(handler, action_sql) do
    schema = handler.schema()
    table = schema.__schema__(:source)
    prefix = schema.__schema__(:prefix)
    stream_field = handler.stream_field()
    actions = Enum.map_join(handler.surface_actions(:community_log), ", ", &"'#{&1}'")

    """
    SELECT '#{handler.resource_type()}' AS log_type,
           id AS local_id,
           hash_id::text AS hash_id,
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
           actor_id,
           actor_snapshot,
           payload,
           metadata,
           occurred_at
    FROM #{prefix}.#{table}
    WHERE community_id = $1
      AND action IN (#{actions})#{action_sql}
    """
  end

  defp to_log(handler, attrs) do
    log_attrs = %{
      id: attrs.local_id,
      hash_id: attrs.hash_id,
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
      actor_id: attrs.actor_id,
      actor_snapshot: attrs.actor_snapshot,
      payload: attrs.payload,
      metadata: attrs.metadata,
      occurred_at: attrs.occurred_at
    }

    struct(handler.schema(), Map.put(log_attrs, handler.stream_field(), attrs.stream_ref))
  end

  defp filter_handlers(nil), do: @handlers

  defp filter_handlers(type) do
    Enum.filter(@handlers, &(to_string(&1.resource_type()) == to_string(type)))
  end

  defp filter_action(handlers, nil), do: handlers

  defp filter_action(handlers, action) when is_atom(action),
    do: Enum.filter(handlers, &(action in &1.surface_actions(:community_log)))

  defp filter_action(_handlers, _action), do: []

  defp pagination(filter) when is_map(filter) do
    page = Map.get(filter, :page, 1)
    supported = [:page, :resource_type, :action]

    if Map.keys(filter) -- supported == [] and is_integer(page) and page > 0,
      do: {:ok, page},
      else: {:error, ErrorCat.invalid_pagination()}
  end
end
