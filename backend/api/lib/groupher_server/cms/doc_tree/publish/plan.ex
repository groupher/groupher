defmodule GroupherServer.CMS.DocTree.Publish.Plan do
  @moduledoc """
  Builds the versioned canonical plan shared by preview, approval and release.

      public tree + queue members -> net tree operations -> normalized structural facts

  The caller owns the consistent transaction snapshot, authorization, Doc
  site ownership, authorization and publishability checks. This module does
  not persist a plan. Public IDs must be read from the same site snapshot.
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.{TargetTree, TreeCodec, TreeOperations}

  @format_version 1
  @node_fields ~w(node_id type parent_node_id index title href doc_id marker badge hidden)a

  @doc "Builds a plan directly from decoded V1 release JSONB and queue change rows."
  def build_from_storage(base_release_id, tree_json, changes, members, public_article_ids) do
    with {:ok, nodes} <- TreeCodec.decode(tree_json),
         {:ok, changes} <- TreeCodec.decode_changes(changes) do
      build(base_release_id, nodes, changes, members, public_article_ids)
    end
  end

  @doc "Builds a V1 structured plan from a consistent set of queue facts."
  def build(base_release_id, public_nodes, changes, members, public_article_ids)
      when (is_nil(base_release_id) or
              (is_integer(base_release_id) and base_release_id > 0 and
                 base_release_id <= 9_223_372_036_854_775_807)) and
             is_list(public_nodes) and is_list(changes) and is_list(members) and
             is_list(public_article_ids) do
    with {:ok, :pass} <- validate_fields(public_nodes, changes),
         {:ok, baseline} <- TargetTree.build(public_nodes, []),
         {:ok, public_ids} <- normalize_public_ids(public_article_ids),
         {:ok, :pass} <- valid_baseline(base_release_id, baseline, public_ids),
         {:ok, articles} <- normalize_members(members),
         {:ok, tree} <- TreeOperations.plan(baseline, changes),
         {:ok, :pass} <- validate_page_membership(baseline, tree.target, articles, public_ids),
         payload = %{
           "plan_format_version" => @format_version,
           "base_release_id" => base_release_id,
           "public_tree" => baseline,
           "articles" => articles,
           "tree_operations" => tree.operations
         } do
      {:ok,
       %{
         format_version: @format_version,
         payload: payload,
         target: tree.target
       }}
    else
      {:error, _reason} = error -> error
    end
  end

  def build(_, _, _, _, _), do: {:error, :invalid_plan_input}

  @doc "Converts validated planner facts to JSONB values without serializing or hashing."
  def storage(value) when is_map(value) do
    Map.new(value, fn {key, item} -> {to_string(key), storage(item)} end)
  end

  def storage(value) when is_list(value), do: Enum.map(value, &storage/1)
  def storage(value) when value in [nil, true, false], do: value
  def storage(value) when is_atom(value), do: Atom.to_string(value)
  def storage(value), do: value

  @doc "Compares a persisted approval with rebuilt, deterministically ordered plan facts."
  def matches?(approved, %{format_version: 1, payload: payload}) when is_map(approved) do
    approved === storage(payload)
  end

  def matches?(_, _), do: false

  defp validate_fields(nodes, changes) do
    valid? =
      Enum.all?(nodes, &fields?(&1, @node_fields)) and
        Enum.all?(changes, fn change ->
          fields?(change, [:node_id, :change_type, :target]) and
            (is_nil(change.target) or fields?(change.target, @node_fields -- [:node_id]))
        end)

    if valid?, do: {:ok, :pass}, else: {:error, :invalid_plan_input}
  end

  defp fields?(value, fields) when is_map(value) do
    Enum.sort(Map.keys(value)) == Enum.sort(fields)
  end

  defp fields?(_, _), do: false

  defp valid_baseline(nil, [], public_ids) do
    if MapSet.size(public_ids) == 0 do
      {:ok, :pass}
    else
      {:error, :missing_public_release}
    end
  end

  defp valid_baseline(nil, _nodes, _public_ids), do: {:error, :missing_public_release}

  defp valid_baseline(_release, nodes, public_ids) do
    if MapSet.subset?(page_ids(nodes), public_ids) do
      {:ok, :pass}
    else
      {:error, :public_tree_without_public_article}
    end
  end

  defp normalize_public_ids(ids) do
    Enum.reduce_while(ids, {:ok, MapSet.new()}, fn id, {:ok, acc} ->
      case Ecto.UUID.cast(id) do
        {:ok, normalized} ->
          if MapSet.member?(acc, normalized) do
            {:halt, {:error, :invalid_public_article_ids}}
          else
            {:cont, {:ok, MapSet.put(acc, normalized)}}
          end

        :error ->
          {:halt, {:error, :invalid_public_article_ids}}
      end
    end)
  end

  defp validate_page_membership(baseline, target, articles, public_ids) do
    target_ids = page_ids(target)
    queued_ids = MapSet.new(articles, & &1["article_id"])
    missing_content = MapSet.difference(target_ids, MapSet.union(public_ids, queued_ids))

    new_without_page =
      queued_ids |> MapSet.difference(public_ids) |> MapSet.difference(target_ids)

    removed_pages = baseline |> page_ids() |> MapSet.difference(target_ids)
    removed_queued = MapSet.intersection(queued_ids, removed_pages)

    cond do
      MapSet.size(missing_content) > 0 ->
        {:error, {:unpublished_pages_without_content, Enum.sort(missing_content)}}

      MapSet.size(new_without_page) > 0 ->
        {:error, {:queued_articles_without_page, Enum.sort(new_without_page)}}

      MapSet.size(removed_queued) > 0 ->
        {:error, {:removed_pages_with_queued_articles, Enum.sort(removed_queued)}}

      true ->
        {:ok, :pass}
    end
  end

  defp page_ids(nodes) do
    nodes |> Enum.filter(&(&1.type == :page)) |> MapSet.new(& &1.doc_id)
  end

  defp normalize_members(members) do
    Enum.reduce_while(members, {:ok, [], MapSet.new(), MapSet.new()}, fn member,
                                                                         {:ok, acc, articles,
                                                                          copies} ->
      with true <- fields?(member, [:article_id, :working_copy_id, :revision]),
           %{article_id: article, working_copy_id: work, revision: revision} <- member,
           {:ok, article} <- Ecto.UUID.cast(article),
           {:ok, work} <- Ecto.UUID.cast(work),
           true <- is_integer(revision) and revision > 0 and revision <= 9_223_372_036_854_775_807,
           false <- MapSet.member?(articles, article) or MapSet.member?(copies, work) do
        item = %{"article_id" => article, "working_copy_id" => work, "revision" => revision}
        {:cont, {:ok, [item | acc], MapSet.put(articles, article), MapSet.put(copies, work)}}
      else
        _ -> {:halt, {:error, :invalid_plan_members}}
      end
    end)
    |> case do
      {:ok, items, _articles, _copies} -> {:ok, Enum.sort_by(items, & &1["article_id"])}
      error -> error
    end
  end
end
