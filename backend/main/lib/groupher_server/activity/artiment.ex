defmodule GroupherServer.Activity.Artiment do
  @moduledoc """
  Routes Article-like resources to their thread-specific Activity handler.

      Activity facade -> CMS Artiment matcher -> thread handler
  """

  alias GroupherServer.Activity
  alias GroupherServer.Activity.ErrorCat
  alias GroupherServer.CMS.Artiment.Matcher

  @handlers %{
    post: Activity.Post,
    blog: Activity.Blog,
    changelog: Activity.Changelog,
    doc: Activity.Doc
  }

  def handlers, do: @handlers

  def handler(resource) do
    try do
      with {:ok, %{thread: thread}} <- Matcher.match(resource),
           {:ok, handler} <- Map.fetch(@handlers, thread) do
        {:ok, handler}
      else
        :error -> {:error, ErrorCat.unsupported_resource("unsupported Activity thread")}
        {:error, _reason} = error -> error
      end
    rescue
      FunctionClauseError ->
        {:error, ErrorCat.unsupported_resource("unsupported Activity thread")}
    end
  end

  def log(resource, action, opts) do
    with {:ok, handler} <- handler(resource), do: handler.log(resource, action, opts)
  end
end
