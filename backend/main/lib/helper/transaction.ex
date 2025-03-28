defmodule Helper.Transaction do
  @moduledoc """
  增强版锁事务工具，提供：
  - 多资源顺序锁定
  - 完整错误堆栈捕获
  - 自动事务管理
  """

  @doc """
  锁定资源并执行事务（保留详细错误）

  ## 示例
      Transaction.locking([article, user], fn [locked_article, locked_user] ->
        # 业务逻辑可以返回:
        # - {:ok, result}
        # - {:error, reason}
        # - 直接值
      end)
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Repo

  @spec locking(any() | [any()], (any() -> any())) :: {:ok, any()} | {:error, any()}
  def locking(resource, fun) when not is_list(resource) do
    try do
      Repo.transaction(fn ->
        locked = lock_resource(resource)

        case fun.(locked) do
          {:ok, result} -> result
          {:error, reason} -> throw({:error, reason})
          value -> value
        end
      end)
    catch
      {:error, reason} -> {:error, reason}
      other -> {:error, {:unexpected_error, other}}
    end
  end

  def locking(resources, fun) when is_list(resources) do
    try do
      Repo.transaction(fn ->
        locked_resources =
          resources
          |> Enum.sort_by(&resource_sort_key/1)
          |> Enum.map(&lock_resource/1)

        case fun.(locked_resources) do
          {:ok, result} -> result
          {:error, reason} -> throw({:error, reason})
          value -> value
        end
      end)
    catch
      {:error, reason} -> {:error, reason}
      other -> {:error, {:unexpected_error, other}}
    end
  end

  defp resource_sort_key(%struct{} = resource), do: {struct.__schema__(:source), resource.id}

  defp lock_resource(%{inner_id: _} = article) do
    article.__struct__
    |> where(id: ^article.id)
    |> preload(author: :user)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  rescue
    Ecto.NoResultsError ->
      throw({:error, {:resource_not_found, article.__struct__}})
  end

  defp lock_resource(resource) do
    resource.__struct__
    |> where(id: ^resource.id)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  rescue
    Ecto.NoResultsError ->
      throw({:error, {:resource_not_found, resource.__struct__}})
  end
end
