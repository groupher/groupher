defmodule Helper.ORMAtom do
  @moduledoc """
  inc/dec: update int field by 1
  update_meta: 提供安全的 JSONB 字段部分更新功能，支持并发安全和最小化数据库写入。
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [strip_struct: 1]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Model.Community

  @default_user_meta Accounts.Model.Embeds.UserMeta.default_meta()
  @default_article_meta CMS.Model.Embeds.ArticleMeta.default_meta()
  @default_community_meta CMS.Model.Embeds.CommunityMeta.default_meta()

  @doc """
  increase by 1 for given field
  """
  def inc(queryable, field) when is_atom(field) do
    update_counter(queryable, field, "+ 1")
  end

  @doc """
  decrease by 1 for given field
  """
  def dec(queryable, field) when is_atom(field) do
    update_counter(queryable, field, "- 1", safeguard: true)
  end

  defp update_counter(queryable, field, operation, opts \\ []) do
    schema_module = queryable.__struct__
    table = schema_module.__schema__(:source)

    prefix =
      case schema_module.__schema__(:prefix) do
        nil -> ""
        prefix -> "#{prefix}."
      end

    full_table = "#{prefix}#{table}"
    id = queryable.id
    safeguard = Keyword.get(opts, :safeguard, false)

    operation_expr =
      if safeguard do
        "GREATEST(#{field} #{operation}, 0)"
      else
        "#{field} #{operation}"
      end

    # SET #{field} = #{field} + 1
    # SET #{field} = GREATEST(#{field} - 1, 0)
    Repo.query(
      """
      UPDATE #{full_table}
      SET #{field} = #{operation_expr}
      WHERE id = $1
      RETURNING #{field}
      """,
      [id]
    )
    |> case do
      {:ok, %Postgrex.Result{rows: [[new_val]]}} ->
        changeset = Ecto.Changeset.change(queryable, %{field => new_val})
        updated = Ecto.Changeset.apply_changes(changeset)
        {:ok, updated}

      error ->
        error
    end
  end

  @doc """
  更新模型的 meta JSONB 字段（部分更新）。

  ## 参数

  - `queryable`: 可以是以下两种形式之一：
    - Ecto 结构体（如 `%Post{}`）
    - Schema 模块（如 `Post`，此时需要传入包含 `:id` 的 updates）

  - `updates`: 要更新的字段映射，支持嵌套路径（用点号分隔）

  ## 返回值

  - `{:ok, updated_struct}` - 更新成功，返回完整结构体
  - `{:error, reason}` - 更新失败，可能原因：
    - `:invalid_queryable` - 输入参数类型错误
    - `:no_primary_key` - 模型没有主键
    - `:not_found` - 记录不存在

  ## 示例

      # 通过结构体更新
      post = Repo.get!(Post, 1)
      {:ok, updated} = update_meta(post, %{
        "views" => 100,
        "author.name" => "张伟"  # 嵌套字段更新
      })

      # 通过模块更新（需在updates中包含id）
      {:ok, updated} = update_meta(Post, %{
        "id" => 1,
        "tags" => ["elixir", "ecto"],
        "stats.visits" => 42
      })
  """
  def update_meta(queryable, changes) when is_struct(changes) do
    update_meta(queryable, changes |> strip_struct)
  end

  def update_meta(%User{meta: nil} = queryable, changes) when is_map(changes) do
    with {:ok, user} <- fill_default_meta(queryable, @default_user_meta) do
      update_meta(user, changes)
    end
  end

  def update_meta(%Community{meta: nil} = queryable, changes) when is_map(changes) do
    with {:ok, user} <- fill_default_meta(queryable, @default_community_meta) do
      update_meta(user, changes)
    end
  end

  # for general article with nil meta
  def update_meta(%{meta: nil} = queryable, changes) when is_map(changes) do
    with {:ok, user} <- fill_default_meta(queryable, @default_article_meta) do
      update_meta(user, changes)
    end
  end

  def update_meta(queryable, changes) when is_map(changes) do
    changes = ensure_datetime(queryable, strip_struct(changes))

    # the later update_all in execute_update will lose all preloaded data, so keep it before it
    preloaded = get_preloaded(queryable)

    with {:ok, schema_module, id} <- extract_schema_and_id(queryable),
         {:ok, dynamic_updates} <- build_dynamic_updates(changes),
         {:ok, primary_key} <- get_primary_key(schema_module),
         {:ok, updated} <- execute_update(schema_module, primary_key, id, dynamic_updates) do
      {:ok, merge_preloaded(updated, preloaded)}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp get_preloaded(%{__struct__: schema} = struct) do
    struct
    |> Map.take(schema.__schema__(:associations))
    |> Enum.filter(fn {_, value} ->
      # 严格检查：必须是已加载的关联或 embed 结构
      case value do
        %Ecto.Association.NotLoaded{} -> false
        _ -> Ecto.assoc_loaded?(value) || is_struct(value)
      end
    end)
    |> Enum.into(%{})
  end

  defp merge_preloaded(updated, preloaded_data) do
    Enum.reduce(preloaded_data, updated, fn {key, value}, acc ->
      if Map.has_key?(acc, key) do
        Map.put(acc, key, value)
      else
        acc
      end
    end)
  end

  defp fill_default_meta(queryable, default_meta) do
    queryable
    |> Ecto.Changeset.change(%{})
    |> Ecto.Changeset.put_embed(:meta, default_meta)
    |> Repo.update()
  end

  defp ensure_datetime(queryable, %{last_active_at: nil} = changes) do
    %{changes | last_active_at: queryable.inserted_at}
  end

  defp ensure_datetime(_queryable, changes), do: changes

  defp extract_schema_and_id(%schema{} = queryable) do
    {:ok, schema, Map.get(queryable, :id)}
  end

  defp extract_schema_and_id(schema) when is_atom(schema) do
    {:ok, schema, nil}
  end

  defp extract_schema_and_id(_), do: {:error, :invalid_queryable}

  defp get_primary_key(schema_module) do
    case schema_module.__schema__(:primary_key) do
      [key] -> {:ok, key}
      _ -> {:error, :no_primary_key}
    end
  end

  defp build_dynamic_updates(changes) do
    base_dynamic = dynamic([r], r.meta)

    dynamic_updates =
      Enum.reduce(changes, base_dynamic, fn {key, value}, acc ->
        path = String.split(to_string(key), ".")
        json_value = prepare_json_value(value)
        dynamic([r], fragment("jsonb_set(?, ?, ?)", ^acc, ^path, ^json_value))
      end)

    {:ok, dynamic_updates}
  end

  defp execute_update(schema_module, primary_key, id, dynamic_updates) do
    # 先构建基础查询
    query = from(r in schema_module)
    # 添加WHERE条件
    query = where(query, [r], field(r, ^primary_key) == ^id)
    query = update(query, [r], set: [meta: ^dynamic_updates])
    # 添加RETURNING
    query = select(query, [r], r)

    case Repo.update_all(query, []) do
      {1, [record]} ->
        {:ok, record}

      {0, []} ->
        {:error, :not_found}
    end
  end

  defp prepare_json_value(value) when is_binary(value), do: value
  defp prepare_json_value(value) when is_number(value), do: value
  defp prepare_json_value(value) when is_boolean(value), do: value
  defp prepare_json_value(value) when is_list(value), do: value
  defp prepare_json_value(value) when is_struct(value, DateTime), do: value
  defp prepare_json_value(value) when is_map(value), do: Jason.encode!(value)
  defp prepare_json_value(value), do: Jason.encode!(value)
end
