defmodule Helper.Cache do
  @moduledoc """
  Cachex-backed application cache facade with named-pool and expiry helpers.

  Business position:

      Domain or web caller
        -> Cache
        -> normalized value / infrastructure
  """
  import Cachex.Spec

  alias GroupherServer.ErrorCat

  @cache_pool Helper.Cache.Config.pool()

  @doc "Runs `config` through the public `Cache` boundary."
  def config(pool_name) do
    pool_config =
      Map.get(@cache_pool, pool_name) ||
        raise ArgumentError, "unknown cache pool: #{inspect(pool_name)}"

    size = pool_config.size
    seconds = pool_config.seconds

    [
      # Cachex v4: use Limit hook instead of `limit: limit(...)`
      hooks: [
        hook(
          module: Cachex.Limit.Scheduled,
          args: {
            # max size
            size,
            # options for Cachex.prune/3
            [reclaim: 0.1],
            # options for the Scheduled hook (e.g. frequency)
            []
          }
        )
      ],
      expiration: expiration(default: :timer.seconds(seconds))
    ]
  end

  # # size, minites
  # def config(:common) do
  #   [
  #     limit: limit(size: 5000, policy: Cachex.Policy.LRW, reclaim: 0.1),
  #     expiration: expiration(default: :timer.minutes(10))
  #   ]
  # end

  # @doc """
  # cache config for user.login -> user.id, used in accounts resolver
  # user.id is a linearly increasing integer and somewhat sensitive, so use user.login instead
  # """
  # def config(:user_login) do
  #   [
  #     limit: limit(size: 10_000, policy: Cachex.Policy.LRW, reclaim: 0.1),
  #     # expired in one week, it's fine, since user's login and id will never change
  #     expiration: expiration(default: :timer.minutes(10_080))
  #   ]
  # end

  # def config(:blog_rss) do
  #   [
  #     limit: limit(size: 1000, policy: Cachex.Policy.LRW, reclaim: 0.1),
  #     # expired in one week, it's fine, since user's login and id will never change
  #     expiration: expiration(default: :timer.minutes(10))
  #   ]
  # end

  @doc """
  ## Example
  iex> Helper.Cache.get(:common, :a)
  {:ok, "b"}
  """
  @spec get(atom(), atom() | String.t()) :: {:error, nil} | {:ok, any}
  def get(pool, key) do
    case Cachex.get(pool, key) do
      {:ok, nil} -> {:error, nil}
      {:ok, result} -> {:ok, result}
    end
  end

  @doc """
  Returns a cached value or loads and caches one value for a missing key.

  The loader must return `{:ok, value}` or `{:error, reason}`. Only successful
  values are cached. A global lock with a second cache check prevents multiple
  callers from loading the same missing key concurrently on connected BEAM
  nodes.
  """
  @spec get_or_fetch(
          atom(),
          atom() | String.t(),
          keyword(),
          (-> {:ok, any()} | {:error, any()})
        ) :: {:ok, any()} | {:error, any()}
  def get_or_fetch(pool, key, options, loader) when is_function(loader, 0) do
    case get(pool, key) do
      {:ok, value} ->
        {:ok, value}

      {:error, nil} ->
        lock_id = {{__MODULE__, pool, key}, self()}

        :global.trans(lock_id, fn ->
          case get(pool, key) do
            {:ok, value} ->
              {:ok, value}

            {:error, nil} ->
              case safe_load(loader) do
                {:ok, value} = result ->
                  case put(pool, key, value, options) do
                    {:ok, _} ->
                      result

                    {:error, reason} ->
                      {:error, ErrorCat.custom(%{reason: :cache_write_failed, details: reason})}
                  end

                {:error, reason} ->
                  {:error, reason}
              end
          end
        end)
    end
  end

  defp safe_load(loader) do
    try do
      case loader.() do
        {:ok, _value} = result -> result
        {:error, %GroupherServer.ErrorCat.Error{} = error} -> {:error, error}
        {:error, reason} -> {:error, ErrorCat.custom(%{reason: :loader_failed, details: reason})}
        value -> {:error, ErrorCat.custom(%{reason: :invalid_loader_result, details: value})}
      end
    rescue
      error -> {:error, ErrorCat.custom(%{reason: :exception, message: Exception.message(error)})}
    catch
      :exit, reason -> {:error, ErrorCat.custom(%{reason: :exit, details: reason})}
      kind, reason -> {:error, ErrorCat.custom(%{reason: kind, details: reason})}
    end
  end

  @doc """
  ## Example
  iex> Helper.Cache.put(a, "x")
  {:ok, "x"}
  """
  def put(pool, key, value) do
    Cachex.put(pool, key, value)
  end

  def put(pool, key, value, []), do: put(pool, key, value)

  def put(pool, key, value, expire_sec: expire_sec) do
    Cachex.put(pool, key, value)
    Cachex.expire(pool, key, :timer.seconds(expire_sec))
  end

  def put(pool, key, value, expire_min: expire_min) do
    Cachex.put(pool, key, value)
    Cachex.expire(pool, key, :timer.minutes(expire_min))
  end

  @doc "Runs `delete` through the public `Cache` boundary."
  def delete(pool, key), do: Cachex.del(pool, key)

  @doc """
  clear all the cache
  ## Example
  iex> Helper.Cache.clear()
  {:ok, 1}
  """
  def clear(pool), do: Cachex.clear(pool)

  @doc """
  cache scope of community contributes digest
  """
  def get_scope(:community_contributes, id), do: "community.contributes.#{id}"
end
