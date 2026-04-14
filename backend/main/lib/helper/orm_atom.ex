defmodule Helper.ORMAtom do
  @moduledoc """
  inc/dec: update int field by 1
  update_meta: 提供安全的 JSONB 字段部分更新功能，支持并发安全和最小化数据库写入。
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [strip_struct: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.{Comment, Community}

  @default_user_meta Accounts.Model.Embeds.UserMeta.default_meta()
  @default_article_meta CMS.Model.Embeds.ArticleMeta.default_meta()
  @default_community_meta CMS.Model.Embeds.CommunityMeta.default_meta()
  @default_comment_meta CMS.Model.Embeds.CommentMeta.default_meta()

  defp update_error(message), do: {:error, {:update_fails, message}}

  @doc """
  Increments a top-level integer field by `1`.

  ## Examples

      iex> ORMAtom.inc(article, :views)
      {:ok, updated_article}
  """
  @spec inc(struct(), atom()) :: {:ok, struct()} | {:error, term()}
  def inc(queryable, field) when is_atom(field) do
    update_counter(queryable, field, "+ 1")
  end

  @doc """
  Decrements a top-level integer field by `1` and never goes below `0`.

  ## Examples

      iex> ORMAtom.dec(article, :upvotes_count)
      {:ok, updated_article}
  """
  @spec dec(struct(), atom()) :: {:ok, struct()} | {:error, term()}
  def dec(queryable, field) when is_atom(field) do
    update_counter(queryable, field, "- 1", safeguard: true)
  end

  @doc """
  Atomically increments an integer value inside a JSONB meta field.

  ## Examples

      iex> ORMAtom.inc_meta(article, :next_floor)
      {:ok, updated_article, 1}
  """
  @spec inc_meta(struct(), atom()) :: {:ok, struct(), integer()} | {:error, term()}
  def inc_meta(queryable, field) when is_struct(queryable) and is_atom(field) do
    schema_module = queryable.__struct__
    id = queryable.id
    field_name = to_string(field)

    # 检查 meta 是否为 nil
    if is_nil(queryable.meta) do
      update_error("meta field is not initialized")
    else
      if not function_exported?(queryable.meta.__struct__, :__schema__, 1) do
        update_error("meta field must be an embedded schema")
      else
        meta_schema = queryable.meta.__struct__
        meta_fields = meta_schema.__schema__(:fields)

        if not Enum.member?(meta_fields, field) do
          update_error("meta field #{field} does not exist")
        else
          if meta_schema.__schema__(:type, field) != :integer do
            update_error("meta field #{field} must be integer")
          else
            # 构建更新查询，使用 RETURNING 子句直接返回新值
            update_query =
              from(q in schema_module,
                where: q.id == ^id,
                update: [
                  set: [
                    meta:
                      fragment(
                        "jsonb_set(meta, ARRAY[?], (COALESCE(meta->>?, '0')::int + 1)::text::jsonb)",
                        ^field_name,
                        ^field_name
                      )
                  ]
                ],
                select: fragment("(meta->>?)::int", ^field_name)
              )

            # 执行更新并获取返回的新值
            case Repo.update_all(update_query, []) do
              {1, [new_val]} ->
                updated_queryable =
                  put_in(queryable.meta, Map.put(queryable.meta, field, new_val))

                {:ok, updated_queryable, new_val}

              {0, []} ->
                {:error, :not_found}
            end
          end
        end
      end
    end
  end

  @doc """
  更新模型的 meta JSONB 字段（部分更新，仅允许更新 meta schema 中已定义的字段路径）。

  ## 参数

  - `queryable`: 可以是以下两种形式之一：
    - Ecto 结构体（如 `%Post{}`）
    - Schema 模块（如 `Post`，此时需要传入包含 `:id` 的 updates）

  - `updates`: 要更新的字段映射，仅支持 meta schema 中已定义的字段路径

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
        reported_count: 100,
        is_comment_locked: true
      })

      # 通过模块更新（需在updates中包含id）
      {:ok, updated} = update_meta(Post, %{
        "id" => 1,
        "reported_user_ids" => [1, 2],
        "reported_count" => 42
      })

      # 通过 atom key 更新顶层 meta 字段
      {:ok, updated} = update_meta(post, %{
        is_comment_locked: true,
        next_floor: 3
      })
  """
  @spec update_meta(struct(), map() | struct()) :: {:ok, struct()} | {:error, term()}
  def update_meta(%{meta: nil} = queryable, changes) when is_map(changes) do
    with {:ok, queryable} <- fill_meta(queryable) do
      update_meta(queryable, changes)
    end
  end

  def update_meta(%{} = changes, %{} = _queryable) when not is_struct(changes) do
    # 处理 map 形式的 queryable（实际上是 changes），保持向后兼容
    {:error, :invalid_queryable}
  end

  def update_meta(queryable, changes) when is_map(changes) do
    changes = ensure_datetime(queryable, strip_struct(changes))

    # the later update_all in execute_update will lose all preloaded data, so keep it before it
    preloaded = get_preloaded(queryable)

    with {:ok, schema_module, id} <- extract_schema_and_id(queryable),
         {:ok, dynamic_updates} <- build_dynamic_updates(queryable, changes),
         {:ok, primary_key} <- get_primary_key(schema_module),
         {:ok, updated} <- execute_update(schema_module, primary_key, id, dynamic_updates) do
      {:ok, merge_preloaded(updated, preloaded)}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @spec fill_meta(struct()) :: {:ok, struct()} | {:error, Ecto.Changeset.t()}
  @doc """
  Fills the default embedded `meta` payload when it is currently `nil`.

  ## Examples

      iex> ORMAtom.fill_meta(user)
      {:ok, user_with_meta}

      iex> ORMAtom.fill_meta(article)
      {:ok, article_with_meta}
  """
  def fill_meta(%User{meta: nil} = user) do
    fill_default_meta(user, @default_user_meta)
  end

  def fill_meta(%Community{meta: nil} = community) do
    fill_default_meta(community, @default_community_meta)
  end

  def fill_meta(%Comment{meta: nil} = community) do
    fill_default_meta(community, @default_comment_meta)
  end

  def fill_meta(%{meta: nil} = article) do
    fill_default_meta(article, @default_article_meta)
  end

  def fill_meta(queryable), do: {:ok, queryable}

  defp update_counter(queryable, field, operation, opts \\ []) do
    schema_module = queryable.__struct__

    case schema_field_type(schema_module, field) do
      {:ok, :integer} ->
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

      {:ok, _type} ->
        update_error("schema field #{field} must be integer")

      {:error, :field_not_found} ->
        update_error("schema field #{field} does not exist")
    end
  end

  defp schema_field_type(schema_module, field) do
    case schema_module.__schema__(:type, field) do
      nil -> {:error, :field_not_found}
      type -> {:ok, type}
    end
  end

  defp get_preloaded(%{__struct__: schema} = struct) do
    struct
    |> Map.take(schema.__schema__(:associations))
    |> Enum.filter(fn {_, value} ->
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

  defp get_primary_key(schema_module) do
    case schema_module.__schema__(:primary_key) do
      [key] -> {:ok, key}
      _ -> {:error, :no_primary_key}
    end
  end

  defp build_dynamic_updates(queryable, changes) do
    base_dynamic = dynamic([r], r.meta)

    with {:ok, validated_changes} <- validate_meta_changes(queryable, changes) do
      dynamic_updates =
        Enum.reduce(validated_changes, base_dynamic, fn {path, value}, acc ->
          json_value = prepare_json_value(value)
          dynamic([r], fragment("jsonb_set(?, ?, ?)", ^acc, ^path, ^json_value))
        end)

      {:ok, dynamic_updates}
    end
  end

  defp validate_meta_changes(queryable, changes) do
    Enum.reduce_while(changes, {:ok, []}, fn {key, value}, {:ok, acc} ->
      path = String.split(to_string(key), ".")

      case validate_meta_path(queryable, path) do
        :ok -> {:cont, {:ok, [{path, value} | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, validated_changes} -> {:ok, Enum.reverse(validated_changes)}
      error -> error
    end
  end

  defp validate_meta_path(%{meta: meta}, [field_name]) when is_struct(meta) do
    field = String.to_existing_atom(field_name)

    if field in meta.__struct__.__schema__(:fields) do
      :ok
    else
      update_error("meta field path #{field_name} does not exist")
    end
  rescue
    ArgumentError -> update_error("meta field path #{field_name} does not exist")
  end

  defp validate_meta_path(_queryable, path) when is_list(path) do
    update_error("meta field path #{Enum.join(path, ".")} is not defined in schema")
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
  defp prepare_json_value(value) when is_atom(value), do: to_string(value)
  defp prepare_json_value(value) when is_list(value), do: value
  defp prepare_json_value(value) when is_struct(value, DateTime), do: value
  defp prepare_json_value(value) when is_map(value), do: value
  defp prepare_json_value(value), do: Jason.encode!(value)
end
