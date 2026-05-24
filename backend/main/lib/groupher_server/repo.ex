defmodule GroupherServer.Repo do
  @moduledoc """
  Ecto repository for Groupher's backend data layer.

  This module is the boundary between business domains and PostgreSQL. It powers
  query execution for contexts such as accounts, CMS content, and statistics, and
  provides pagination defaults through `Scrivener`.
  """
  import Helper.Utils, only: [get_config: 2]

  use Ecto.Repo, otp_app: :groupher_server, adapter: Ecto.Adapters.Postgres
  use Scrivener, page_size: get_config(:general, :page_size)

  @dialyzer {:nowarn_function, rollback: 1}

  @doc """
  Dynamically loads the repository url from the
  DATABASE_URL environment variable.
  """
  # def init(_, opts) do
  #   {:ok, Keyword.put(opts, :url, System.get_env("DATABASE_URL"))}
  # end
end
