defmodule Helper.OSS do
  @moduledoc """
  find city info by ip
  refer: https://lbs.amap.com/api/webservice/guide/api/ipconfig/?sug_index=0
  """
  use Tesla, only: [:get]

  import Helper.ErrorCode

  alias Aliyun.Oss.Config
  alias Aliyun.Oss.Object

  @sts_role_arn "acs:ram::1974251283640986:role/groupheross"
  # set in aliyun's console
  @sts_role_name "GroupherOSS"

  @timeout_limit 4000

  @bucket "groupher"
  @tmp_dir "_tmp"

  plug(Tesla.Middleware.JSON)
  plug(Tesla.Middleware.Retry, delay: 200, max_retries: 2)
  plug(Tesla.Middleware.Timeout, timeout: @timeout_limit)
  plug(Tesla.Middleware.PathParams)
  # plug(Tesla.Middleware.Logger, debug: false)

  def persist_file(args, field) when map_size(args) > 0 do
    with {:ok, file} <- get_file_path(args, field),
         {:ok, _} <- persist_file(file) do
      fmt_addr(args, field, file)
    end
  end

  def persist_file(file) do
    case skip_persist_file(file) do
      true -> {:ok, :pass}
      false -> do_persit_file(file)
    end
  end

  def skip_persist_file(file) do
    Mix.env() == :test or not String.starts_with?(file, "ugc/_tmp")
  end

  defp do_persit_file(file) do
    with {:ok, _} <- copy_file(file) do
      delete_file(file)
    end
  end

  @doc """
  get sts tmp token for upload file follow a spec policy defined on aliyun
  """
  def get_sts_token() do
    params = %{
      "Action" => "AssumeRole",
      "RoleArn" => @sts_role_arn,
      "RoleSessionName" => @sts_role_name,
      "DurationSeconds" => 3600
    }

    with {:ok, %{status: 200, body: body}} <- ExAliyun.OpenAPI.call_sts(params) do
      {:ok, body}
    else
      {:ok, %{status: 404, body: body}} ->
        {:error, body["Code"]}
        {:error, [message: "oss sts token error", code: ecode(:oss_sts_token)]}

      _ ->
        {:error, [message: "oss sts token error", code: ecode(:oss_sts_token)]}
    end
  end

  def fmt_addr(args, field, file) when map_size(args) > 0 do
    args |> Map.put(field, replace_addr(file))
  end

  # def fmt_addr(args, field) when map_size(args) > 0 do
  #   case get_in(args, [field]) do
  #     nil -> args
  #     srcVal -> args |> Map.put(field, replace_addr(srcVal))
  #   end
  # end

  defp get_file_path(args, field) when map_size(args) > 0 do
    case get_in(args, [field]) do
      nil -> args
      file -> {:ok, file}
    end
  end

  defp replace_addr(src) do
    case String.starts_with?(src, "ugc/#{@tmp_dir}") do
      true -> String.replace(src, "ugc/#{@tmp_dir}", "ugc", global: false)
      false -> src
    end
  end

  def fmt_addr(src) when is_binary(src) do
    replace_addr(src)
  end

  defp copy_file(file) do
    target = {"#{@bucket}", file}
    dest = {"#{@bucket}", fmt_addr(file)}

    Object.copy_object(config(), target, dest)
  end

  defp delete_file(file) do
    Object.delete_object(config(), "#{@bucket}", file)
  end

  defp config() do
    :groupher_server
    |> Application.fetch_env!(Helper.OSS)
    |> Map.new()
    |> Config.new!()
  end
end
