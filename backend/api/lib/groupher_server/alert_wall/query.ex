defmodule GroupherServer.AlertWall.Query do
  @moduledoc """
  Authorized read access to AlertWall items and reporter-owned user reports.

  Business position:

      GraphQL resolver
        -> AlertWall public query
          -> scope authorization
          -> item/report reads
  """

  import Ecto.Query

  alias GroupherServer.AlertWall
  alias GroupherServer.{CMS, Repo}
  alias AlertWall.Model.{Item, UserReport}
  alias CMS.Model.Community

  @doc "Lists items visible to an authorized platform or community reviewer."
  def list_items(scope, filter, actor, pagi \\ nil) do
    with {:ok, community_id, permission} <- normalize_scope(scope),
         {:ok, :pass} <- authorize(actor, permission) do
      query =
        from(item in Item,
          where: item.status == :open,
          order_by: [desc: item.opened_at, desc: item.id]
        )

      query =
        if is_nil(community_id),
          do: where(query, [item], is_nil(item.community_id)),
          else: where(query, [item], item.community_id == ^community_id)

      query = apply_item_filter(query, filter)

      binding = %{
        surface: "alert_wall.items",
        order: %{"sort" => "opened_at_desc_id_desc"},
        fingerprint: Base.encode64(:crypto.hash(:sha256, :erlang.term_to_binary({community_id})))
      }

      Helper.ORM.Pagi.Window.run(
        pagi || default_pagi(),
        binding,
        fn offset, size ->
          entries = Repo.all(from(item in query, limit: ^size, offset: ^offset))
          {:ok, %{entries: entries, total: Repo.aggregate(query, :count, :id)}}
        end,
        max_entries: 500
      )
    end
  end

  @doc "Loads one item only when its scope permits reviewer access."
  def item(item_id, actor) when is_integer(item_id) and item_id > 0 do
    case Repo.get(Item, item_id) do
      %Item{community_id: nil} = item ->
        with {:ok, :pass} <- authorize(actor, "review.platform.read"), do: {:ok, item}

      %Item{community_id: community_id} = item ->
        with {:ok, %Community{slug: slug}} <- community(community_id),
             {:ok, :pass} <- authorize(actor, "review.read", %{community: slug}) do
          {:ok, item}
        end

      nil ->
        {:error, GroupherServer.AlertWall.ErrorCat.item_not_found()}
    end
  end

  def item(_item_id, _actor), do: {:error, GroupherServer.AlertWall.ErrorCat.item_not_found()}

  @doc "Lists the current user's original report facts, including withdrawn history."
  def my_reports(actor, filter, pagi \\ nil) do
    with %{id: reporter_id} when is_integer(reporter_id) <- actor do
      query =
        from(report in UserReport,
          where: report.reporter_id == ^reporter_id,
          order_by: [desc: report.inserted_at, desc: report.id]
        )

      query = apply_report_filter(query, filter)

      binding = %{
        surface: "alert_wall.my_reports",
        order: %{"sort" => "inserted_at_desc_id_desc"},
        fingerprint: Base.encode64(:crypto.hash(:sha256, :erlang.term_to_binary(reporter_id)))
      }

      Helper.ORM.Pagi.Window.run(
        pagi || default_pagi(),
        binding,
        fn offset, size ->
          entries = Repo.all(from(report in query, limit: ^size, offset: ^offset))
          {:ok, %{entries: entries, total: Repo.aggregate(query, :count, :id)}}
        end,
        max_entries: 500
      )
    else
      _ -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end

  @doc "Counts active reports authored by one account."
  def reported_count(user_id) when is_integer(user_id) do
    Repo.one(
      from(report in UserReport,
        where:
          report.reporter_id == ^user_id and is_nil(report.withdrawn_at) and
            is_nil(report.outdated_at) and is_nil(report.resolved_at),
        select: count(report.id)
      )
    ) || 0
  end

  def reported_count(_user_id), do: 0

  defp apply_item_filter(query, filter) when is_map(filter) do
    query =
      case Map.get(filter, :target_type) do
        nil -> query
        target_type -> where(query, [item], item.target_type == ^target_type)
      end

    query =
      case Map.get(filter, :owner) do
        nil -> query
        owner -> where(query, [item], item.owner == ^owner)
      end

    case Map.get(filter, :has_reports) do
      true ->
        from(item in query,
          as: :alert_item,
          where:
            exists(
              from(report in UserReport,
                where:
                  report.item_id == parent_as(:alert_item).id and
                    is_nil(report.withdrawn_at) and is_nil(report.outdated_at)
              )
            )
        )

      false ->
        from(item in query,
          as: :alert_item,
          where:
            not exists(
              from(report in UserReport,
                where:
                  report.item_id == parent_as(:alert_item).id and
                    is_nil(report.withdrawn_at) and is_nil(report.outdated_at)
              )
            )
        )

      _ ->
        query
    end
  end

  defp apply_item_filter(query, _filter), do: query

  defp apply_report_filter(query, filter) when is_map(filter) do
    query =
      case Map.get(filter, :target_type) do
        nil -> query
        target_type -> where(query, [report], report.target_type == ^target_type)
      end

    case Map.get(filter, :status) do
      :active ->
        where(
          query,
          [report],
          is_nil(report.withdrawn_at) and is_nil(report.outdated_at) and
            is_nil(report.resolved_at)
        )

      :withdrawn ->
        where(query, [report], not is_nil(report.withdrawn_at))

      :outdated ->
        where(query, [report], not is_nil(report.outdated_at))

      :resolved ->
        where(query, [report], not is_nil(report.resolved_at))

      _ ->
        query
    end
  end

  defp apply_report_filter(query, _filter), do: query

  defp default_pagi, do: %{offset: %{page: 1, size: 50}}

  defp normalize_scope(%{type: :platform}), do: {:ok, nil, "review.platform.read"}

  defp normalize_scope(%{type: :community, community: %Community{id: id, slug: slug}}) do
    {:ok, id, {"review.read", %{community: slug}}}
  end

  defp normalize_scope(_scope), do: {:error, CMS.passport_error_cat_permission_denied()}

  defp authorize(actor, {permission, params}), do: authorize(actor, permission, params)
  defp authorize(actor, permission), do: authorize(actor, permission, %{})

  defp authorize(actor, permission, params) do
    case CMS.passport_authorization_check(actor, permission, params) do
      {:ok, true} -> {:ok, :pass}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end

  defp community(id) do
    case Repo.get(Community, id) do
      %Community{} = community -> {:ok, community}
      nil -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end
end
