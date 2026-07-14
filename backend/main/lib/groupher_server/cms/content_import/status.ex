defmodule GroupherServer.CMS.ContentImport.Status do
  @moduledoc "Central status vocabulary shared by persistence, workers, and API projection."

  @connection ~w(active disabled)a
  @job ~w(pending loading planning staging ready applying completed failed cancelled)a
  @job_asset ~w(pending staging ready failed cancelled)a

  @spec connection() :: [atom()]
  def connection, do: @connection

  @spec job() :: [atom()]
  def job, do: @job

  @spec job_asset() :: [atom()]
  def job_asset, do: @job_asset
end
