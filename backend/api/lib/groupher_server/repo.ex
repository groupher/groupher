defmodule GroupherServer.Repo do
  @moduledoc """
  Ecto repository for Groupher's backend data layer.

  This module is the boundary between business domains and PostgreSQL. It powers
  query execution for contexts such as accounts, CMS content, and statistics, and
  exposes the repository used by the shared `Helper.ORM.Pagi` execution boundary.

  Business position:

      Application caller
        -> Repo
        -> domain / infrastructure boundary
  """

  use Ecto.Repo, otp_app: :groupher_server, adapter: Ecto.Adapters.Postgres

  @dialyzer {:nowarn_function, rollback: 1}

  @impl true
  def init(_type, options) do
    migration_database = System.get_env("GROUPHER_MANAGED_MIGRATION_DATABASE")

    if migration_database && Application.get_env(:groupher_server, :env) in [:dev, :test] do
      expected_port = Integer.parse(System.get_env("GROUPHER_MANAGED_MIGRATION_PORT", ""))
      expected_host = System.get_env("GROUPHER_MANAGED_MIGRATION_HOST")

      unless options[:database] == migration_database and options[:hostname] == expected_host and
               expected_port == {options[:port], ""} and
               Enum.all?([:url, :socket, :socket_dir], &is_nil(options[&1])) do
        raise "Repository options conflict with the verified migration target."
      end
    end

    case Application.get_env(:groupher_server, :managed_database_target) do
      nil ->
        {:ok, options}

      expected ->
        matching =
          Enum.all?([:database, :hostname, :port, :username], fn key ->
            Keyword.get(options, key) == Keyword.fetch!(expected, key)
          end)

        if matching and Enum.all?([:url, :socket, :socket_dir], &is_nil(options[&1])) do
          {:ok, options}
        else
          raise "Repository options conflict with the managed database target."
        end
    end
  end

  @doc """
  Runs a business transaction whose callback returns a tagged result.

  `{:error, reason}` is converted to `rollback(reason)` so callers cannot
  accidentally commit a failed business result. Any other shape is rejected.
  """
  @spec transact_result((-> {:ok, value} | {:error, reason})) ::
          {:ok, value} | {:error, reason}
        when value: term(), reason: term()
  def transact_result(callback) when is_function(callback, 0) do
    transaction(fn ->
      case callback.() do
        {:ok, value} -> value
        {:error, reason} -> rollback(reason)
        other -> rollback({:invalid_transaction_result, other})
      end
    end)
  end

  @doc """
  Dynamically loads the repository url from the
  DATABASE_URL environment variable.
  """
  # def init(_, opts) do
  #   {:ok, Keyword.put(opts, :url, System.get_env("DATABASE_URL"))}
  # end
end
