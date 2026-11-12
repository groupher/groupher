defmodule GroupherServer.CMS.Articles.WorkingCopy.Diff do
  @moduledoc """
  Compares saved Article content while preserving Plate node identity and CoverEdit differences.

      two WorkingCopies or Snapshot/Public -> typed owner content -> field-level content diff
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    ArticleSnapshot,
    ArticlePublic,
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
         true <- left.article_id == right.article_id do
      {:ok, compare_content(left, right)}
    else
      false -> {:error, :snapshot_owner_mismatch}
      {:error, _reason} = error -> error
    end
  end

  @doc "Compares the default WorkingCopy with the currently selected public Snapshot."
  def compare_public(%Article{id: article_id}) do
    work =
      Repo.one(
        from(work in ArticleWorkingCopy,
          where:
            work.article_id == ^article_id and work.scope_kind == :default and
              work.scope_id == ^article_id
        )
      )

    public = Repo.get(ArticlePublic, article_id)

    case {work, public} do
      {%ArticleWorkingCopy{id: work_id}, %ArticlePublic{snapshot_id: snapshot_id}} ->
        compare(work_id, snapshot_id)

      {%ArticleWorkingCopy{} = work, nil} ->
        {:ok,
         %{
           body: %{added: [], removed: [], changed: [], moved: [], equal: false},
           fields: %{title: %{before: nil, after: work.title}},
           tags: %{added: [], removed: []},
           cover_edit: false,
           asset_refs: false,
           left_kind: :snapshot,
           right_kind: :working_copy
         }}

      {nil, _public} ->
        {:error, :working_copy_not_found}
    end
  end

  @doc "Reports whether the default WorkingCopy differs from the selected Snapshot."
  def unpublished?(%Article{} = article) do
    with {:ok, diff} <- compare_public(article) do
      {:ok,
       not diff.body.equal or map_size(diff.fields) > 0 or diff.tags.added != [] or
         diff.tags.removed != [] or diff.cover_edit or diff.asset_refs}
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
      asset_refs: asset_refs_changed?(l, r),
      left_kind: l.kind,
      right_kind: r.kind
    }
  end

  defp body_diff(left, right) do
    left_nodes = index_nodes(left)
    right_nodes = index_nodes(right)
    ids = Enum.uniq(Map.keys(left_nodes) ++ Map.keys(right_nodes))

    %{
      added: Enum.filter(ids, &(not Map.has_key?(left_nodes, &1))),
      removed: Enum.filter(ids, &(not Map.has_key?(right_nodes, &1))),
      changed:
        Enum.filter(ids, fn id ->
          Map.has_key?(left_nodes, id) and Map.has_key?(right_nodes, id) and
            elem(left_nodes[id], 1) != elem(right_nodes[id], 1)
        end),
      moved:
        Enum.filter(ids, fn id ->
          Map.has_key?(left_nodes, id) and Map.has_key?(right_nodes, id) and
            elem(left_nodes[id], 0) != elem(right_nodes[id], 0)
        end),
      equal: left == right
    }
  end

  defp index_nodes(nodes) when is_list(nodes) do
    nodes
    |> Enum.with_index()
    |> Enum.reduce(%{}, fn {node, index}, acc -> index_node(node, [index], acc) end)
  end

  defp index_nodes(_), do: %{}

  defp index_node(value, path, acc) when is_list(value) do
    value
    |> Enum.with_index()
    |> Enum.reduce(acc, fn {child, index}, current ->
      index_node(child, path ++ [index], current)
    end)
  end

  defp index_node(value, path, acc) when is_map(value) do
    id = Map.get(value, "id") || Map.get(value, :id)
    type = Map.get(value, "type") || Map.get(value, :type)

    acc =
      if is_binary(id) do
        Map.put(acc, id, {path, value})
      else
        if is_binary(type) do
          Map.put(acc, "position:#{Enum.join(path, ".")}", {path, value})
        else
          acc
        end
      end

    value
    |> Enum.sort_by(fn {key, _child} -> to_string(key) end)
    |> Enum.reduce(acc, fn {key, child}, current ->
      index_node(child, path ++ [to_string(key)], current)
    end)
  end

  defp index_node(_value, _path, acc), do: acc

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
    |> order_by([ref], asc: ref.usage, asc: ref.position, asc: ref.id)
    |> select([ref], {ref.asset_id, ref.usage, ref.position, ref.block_id, ref.alt, ref.title})
    |> Repo.all()
  end

  defp owner_refs(%{kind: :snapshot, value: snapshot}) do
    ArticleAssetRef
    |> where([ref], ref.snapshot_id == ^snapshot.id)
    |> order_by([ref], asc: ref.usage, asc: ref.position, asc: ref.id)
    |> select([ref], {ref.asset_id, ref.usage, ref.position, ref.block_id, ref.alt, ref.title})
    |> Repo.all()
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
