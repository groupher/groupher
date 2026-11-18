defmodule GroupherServer.CMS.Articles.WorkingCopy.Diff do
  @moduledoc """
  Compares saved Article content while preserving Plate node identity and CoverEdit differences.

      two WorkingCopies or Snapshot/Public -> typed owner content -> field-level content diff
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    ArticleSnapshot,
    ArticleSnapshotBlog,
    ArticleSnapshotChangelog,
    ArticleSnapshotDoc,
    ArticleSnapshotPost,
    ArticleSnapshotTag,
    ArticleWorkingCopy,
    ArticleWorkingCopyTag,
    ArticleWorkingCopyPost,
    ArticleWorkingCopyBlog,
    ArticleWorkingCopyChangelog,
    ArticleWorkingCopyDoc,
    ArticleAssetRef,
    Article
  }

  @doc "Compares two owned versions; accepted refs are WorkingCopy and/or Snapshot IDs."
  def compare(left_id, right_id) when is_binary(left_id) and is_binary(right_id) do
    with {:ok, left} <- load(left_id),
         {:ok, right} <- load(right_id),
         {:ok, diff} <- compare_loaded(left, right) do
      {:ok, diff}
    end
  end

  @doc "Compares explicitly typed version records to avoid ambiguous cross-table UUID lookup."
  def compare_versions(%ArticleSnapshot{} = left, right)
      when is_struct(right, ArticleSnapshot) or is_struct(right, ArticleWorkingCopy) do
    with {:ok, left} <- load_snapshot(left),
         {:ok, right} <- load_version_record(right),
         {:ok, diff} <- compare_loaded(left, right) do
      {:ok, diff}
    end
  end

  defp load(id) do
    case Repo.get(ArticleWorkingCopy, id) do
      %ArticleWorkingCopy{} = work ->
        {:ok,
         %{
           kind: :working_copy,
           value: work,
           article_id: work.article_id,
           thread: thread(work.article_id)
         }}

      nil ->
        case Repo.get(ArticleSnapshot, id) do
          %ArticleSnapshot{} = snapshot ->
            {:ok,
             %{
               kind: :snapshot,
               value: snapshot,
               article_id: snapshot.article_id,
               thread: thread(snapshot.article_id)
             }}

          nil ->
            {:error, :content_not_found}
        end
    end
  end

  defp compare_content(%{value: left} = l, %{value: right} = r) do
    left_body = decode_body(CMS.Articles.Body.document(left).json)
    right_body = decode_body(CMS.Articles.Body.document(right).json)
    left_tags = tag_ids(l)
    right_tags = tag_ids(r)

    %{
      body: body_diff(left_body, right_body),
      fields: changed_fields(left, right, ~w(title digest slug)a) |> Map.merge(typed_diff(l, r)),
      tags: %{added: right_tags -- left_tags, removed: left_tags -- right_tags},
      cover_edit: cover_edit_content(l) != cover_edit_content(r),
      cover: %{before: cover_edit_content(l), after: cover_edit_content(r)},
      asset_refs: asset_refs_changed?(l, r),
      assetRefs: asset_ref_diff(owner_refs(l), owner_refs(r)),
      left_kind: l.kind,
      right_kind: r.kind
    }
  end

  defp compare_loaded(left, right) do
    with {:ok, :pass} <- validate_typed_owner(left),
         {:ok, :pass} <- validate_typed_owner(right),
         true <- left.article_id == right.article_id do
      {:ok, compare_content(left, right)}
    else
      false -> {:error, :snapshot_owner_mismatch}
      {:error, _reason} = error -> error
    end
  end

  defp load_snapshot(%ArticleSnapshot{} = snapshot) do
    {:ok,
     %{
       kind: :snapshot,
       value: snapshot,
       article_id: snapshot.article_id,
       thread: thread(snapshot.article_id)
     }}
  end

  defp load_version_record(%ArticleSnapshot{} = snapshot), do: load_snapshot(snapshot)

  defp load_version_record(%ArticleWorkingCopy{} = work) do
    {:ok,
     %{
       kind: :working_copy,
       value: work,
       article_id: work.article_id,
       thread: thread(work.article_id)
     }}
  end

  defp body_diff(left, right) do
    left_nodes = index_nodes(left)
    right_nodes = index_nodes(right)
    ids = Enum.uniq(Map.keys(left_nodes) ++ Map.keys(right_nodes)) |> Enum.sort()

    %{
      added:
        Enum.flat_map(ids, fn id ->
          case {Map.get(left_nodes, id), Map.get(right_nodes, id)} do
            {nil, %{value: value}} -> [%{id: id, after: value}]
            _ -> []
          end
        end),
      removed:
        Enum.flat_map(ids, fn id ->
          case {Map.get(left_nodes, id), Map.get(right_nodes, id)} do
            {%{value: value}, nil} -> [%{id: id, before: value}]
            _ -> []
          end
        end),
      changed:
        Enum.flat_map(ids, fn id ->
          case {Map.get(left_nodes, id), Map.get(right_nodes, id)} do
            {%{compare: before}, %{compare: after_value}} when before != after_value ->
              [%{id: id, before: before, after: after_value}]

            _ ->
              []
          end
        end),
      moved: moved_nodes(left_nodes, right_nodes),
      duplicate_ids:
        (Map.keys(left_nodes) ++ Map.keys(right_nodes))
        |> Enum.filter(&String.starts_with?(&1, "duplicate:"))
        |> Enum.map(&(String.split(&1, ":", parts: 3) |> Enum.at(1)))
        |> Enum.uniq()
        |> Enum.sort(),
      degraded_ids:
        ids
        |> Enum.filter(&String.starts_with?(&1, "position:"))
        |> Enum.map(&String.replace_prefix(&1, "position:", "")),
      equal: left == right
    }
  end

  defp index_nodes(nodes) when is_list(nodes) do
    nodes
    |> Enum.with_index()
    |> Enum.reduce(%{}, fn {node, index}, acc -> index_node(node, [index], acc, nil, index) end)
  end

  defp index_nodes(_), do: %{}

  defp index_node(value, path, acc, parent_id, _sibling_index) when is_list(value) do
    value
    |> Enum.with_index()
    |> Enum.reduce(acc, fn {child, index}, current ->
      index_node(child, path ++ [index], current, parent_id, index)
    end)
  end

  defp index_node(value, path, acc, parent_id, sibling_index) when is_map(value) do
    id = Map.get(value, "id") || Map.get(value, :id)
    type = Map.get(value, "type") || Map.get(value, :type)

    key =
      if is_binary(id) do
        if Map.has_key?(acc, id), do: "duplicate:#{id}:#{Enum.join(path, ".")}", else: id
      else
        if is_binary(type) do
          "position:#{Enum.join(path, ".")}"
        else
          nil
        end
      end

    compare = comparable_node(value)

    acc =
      if key,
        do:
          Map.put(acc, key, %{
            path: path,
            value: value,
            compare: compare,
            parent_id: parent_id,
            sibling_index: sibling_index
          }),
        else: acc

    next_parent = if is_binary(id), do: id, else: parent_id

    value
    |> Enum.sort_by(fn {key, _child} -> to_string(key) end)
    |> Enum.reduce(acc, fn {key, child}, current ->
      index_node(child, path ++ [to_string(key)], current, next_parent, nil)
    end)
  end

  defp index_node(_value, _path, acc, _parent_id, _sibling_index), do: acc

  defp comparable_node(value) do
    children = Map.get(value, "children") || Map.get(value, :children)

    value
    |> Map.drop(["children", :children])
    |> Map.put("inline_children", inline_children(children))
  end

  defp inline_children(children) when is_list(children) do
    Enum.filter(children, fn
      %{"text" => _} = child -> not Map.has_key?(child, "type") and not Map.has_key?(child, "id")
      %{text: _} = child -> not Map.has_key?(child, :type) and not Map.has_key?(child, :id)
      child when not is_map(child) and not is_list(child) -> true
      _ -> false
    end)
  end

  defp inline_children(_), do: []

  defp moved_nodes(left_nodes, right_nodes) do
    common = Map.keys(left_nodes) -- (Map.keys(left_nodes) -- Map.keys(right_nodes))

    Enum.flat_map(common, fn id ->
      left = Map.fetch!(left_nodes, id)
      right = Map.fetch!(right_nodes, id)

      parent_changed? = left.parent_id != right.parent_id

      order_changed? =
        Enum.any?(common -- [id], fn other_id ->
          other_left = Map.fetch!(left_nodes, other_id)
          other_right = Map.fetch!(right_nodes, other_id)

          is_integer(left.sibling_index) and is_integer(other_left.sibling_index) and
            is_integer(right.sibling_index) and is_integer(other_right.sibling_index) and
            left.parent_id == other_left.parent_id and right.parent_id == other_right.parent_id and
            sign(left.sibling_index - other_left.sibling_index) !=
              sign(right.sibling_index - other_right.sibling_index)
        end)

      if parent_changed? or order_changed?,
        do: [%{id: id, from: left.path, to: right.path}],
        else: []
    end)
  end

  defp sign(value) when value < 0, do: -1
  defp sign(value) when value > 0, do: 1
  defp sign(_), do: 0

  defp decode_body(body_json) do
    case Jason.decode(body_json) do
      {:ok, value} -> value
      _ -> body_json
    end
  end

  defp changed_fields(left, right, fields) do
    Map.new(fields, fn field ->
      {field, %{before: Map.get(left, field), after: Map.get(right, field)}}
    end)
    |> Enum.reject(fn {_field, values} -> values.before == values.after end)
    |> Map.new()
  end

  defp tag_ids(%{kind: :working_copy, value: work}) do
    ArticleWorkingCopyTag
    |> where([tag], tag.working_copy_id == ^work.id)
    |> select([tag], tag.tag_id)
    |> Repo.all()
    |> Enum.sort()
  end

  defp tag_ids(%{kind: :snapshot, value: snapshot}) do
    ArticleSnapshotTag
    |> where([tag], tag.snapshot_id == ^snapshot.id)
    |> select([tag], tag.tag_id)
    |> Repo.all()
    |> Enum.sort()
  end

  defp cover_edit_content(%{kind: :working_copy, value: work}) do
    cover_values(GroupherServer.CMS.Model.CoverEditWorkingCopy, work.cover_edit_working_copy_id)
  end

  defp cover_edit_content(%{kind: :snapshot, value: snapshot}) do
    cover_values(GroupherServer.CMS.Model.CoverEditSnapshot, snapshot.cover_edit_snapshot_id)
  end

  defp cover_values(_model, nil), do: nil

  defp cover_values(model, id) do
    case Repo.get(model, id) do
      nil -> nil
      cover -> Map.take(cover, ~w(format_version canvas_width canvas_height light dark)a)
    end
  end

  defp asset_refs_changed?(left, right) do
    owner_refs(left) != owner_refs(right)
  end

  defp owner_refs(%{kind: :working_copy, value: work}) do
    ArticleAssetRef
    |> where([ref], ref.working_copy_id == ^work.id)
    |> select([ref], {ref.asset_id, ref.usage, ref.position, ref.block_id, ref.alt, ref.title})
    |> Repo.all()
    |> Enum.sort()
  end

  defp owner_refs(%{kind: :snapshot, value: snapshot}) do
    ArticleAssetRef
    |> where([ref], ref.snapshot_id == ^snapshot.id)
    |> select([ref], {ref.asset_id, ref.usage, ref.position, ref.block_id, ref.alt, ref.title})
    |> Repo.all()
    |> Enum.sort()
  end

  defp asset_ref_diff(before, after_refs) do
    before_by_key = Map.new(with_asset_occurrences(before))
    after_by_key = Map.new(with_asset_occurrences(after_refs))
    keys = Enum.uniq(Map.keys(before_by_key) ++ Map.keys(after_by_key)) |> Enum.sort()

    %{
      added:
        Enum.flat_map(keys, fn key ->
          case {Map.get(before_by_key, key), Map.get(after_by_key, key)} do
            {nil, value} when not is_nil(value) -> [asset_ref_map(value)]
            _ -> []
          end
        end),
      removed:
        Enum.flat_map(keys, fn key ->
          case {Map.get(before_by_key, key), Map.get(after_by_key, key)} do
            {value, nil} when not is_nil(value) -> [asset_ref_map(value)]
            _ -> []
          end
        end),
      changed:
        Enum.flat_map(keys, fn key ->
          case {Map.get(before_by_key, key), Map.get(after_by_key, key)} do
            {before_ref, after_ref}
            when not is_nil(before_ref) and not is_nil(after_ref) and before_ref != after_ref ->
              [%{before: asset_ref_map(before_ref), after: asset_ref_map(after_ref)}]

            _ ->
              []
          end
        end)
    }
  end

  defp with_asset_occurrences(refs) do
    refs
    |> Enum.group_by(&asset_ref_identity/1)
    |> Enum.flat_map(fn {identity, values} ->
      values
      |> Enum.sort()
      |> Enum.with_index()
      |> Enum.map(fn {value, index} -> {{identity, index}, value} end)
    end)
  end

  defp asset_ref_identity({asset_id, usage, _position, block_id, _alt, _title}),
    do: {asset_id, usage, block_id}

  defp asset_ref_map({asset_id, usage, position, block_id, alt, title}) do
    %{
      asset_id: asset_id,
      usage: usage,
      position: position,
      block_id: block_id,
      alt: alt,
      title: title
    }
  end

  defp validate_typed_owner(%{kind: kind, value: owner, thread: thread}) do
    {working_copy_model, snapshot_model, _fields} = typed_models(thread)

    case typed_model(kind, working_copy_model, snapshot_model) do
      nil ->
        {:ok, :pass}

      model ->
        if Repo.exists?(from(row in model, where: field(row, ^owner_field(kind)) == ^owner.id)) do
          {:ok, :pass}
        else
          {:error, :missing_typed_content}
        end
    end
  end

  defp typed_diff(%{kind: left_kind, value: left, thread: thread}, %{
         kind: right_kind,
         value: right
       }) do
    {working_copy_model, snapshot_model, fields} = typed_models(thread)
    left_model = typed_model(left_kind, working_copy_model, snapshot_model)
    right_model = typed_model(right_kind, working_copy_model, snapshot_model)

    with model when not is_nil(model) <- left_model,
         model when not is_nil(model) <- right_model,
         left_row when not is_nil(left_row) <-
           Repo.get_by(left_model, [{owner_field(left_kind), left.id}]),
         right_row when not is_nil(right_row) <-
           Repo.get_by(right_model, [{owner_field(right_kind), right.id}]) do
      changed_fields(left_row, right_row, fields)
    else
      _ -> %{}
    end
  end

  defp typed_diff(_left, _right), do: %{}

  defp owner_field(:working_copy), do: :working_copy_id
  defp owner_field(:snapshot), do: :snapshot_id

  defp typed_model(:working_copy, working_copy_model, _snapshot_model), do: working_copy_model
  defp typed_model(:snapshot, _working_copy_model, snapshot_model), do: snapshot_model

  defp typed_models(:post) do
    {ArticleWorkingCopyPost, ArticleSnapshotPost,
     ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_models(:blog) do
    {ArticleWorkingCopyBlog, ArticleSnapshotBlog,
     ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_models(:changelog) do
    {ArticleWorkingCopyChangelog, ArticleSnapshotChangelog,
     ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_models(:doc) do
    {ArticleWorkingCopyDoc, ArticleSnapshotDoc,
     ~w(subtitle link_addr template_key cover_url cover_url_dark)a}
  end

  defp typed_models(_), do: {nil, nil, []}

  defp thread(article_id) do
    case Repo.get(Article, article_id) do
      %Article{thread: value} -> value
      _ -> nil
    end
  end
end
