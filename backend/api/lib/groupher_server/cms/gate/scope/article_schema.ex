defmodule GroupherServer.CMS.Gate.Scope.ArticleSchema do
  @moduledoc """
  Resolves the concrete Article schema for a stable CMS thread.

  Business position:

      Gate Scope context
        -> ArticleSchema
        -> root schema validation

  Examples:

      iex> {:ok, GroupherServer.CMS.Model.Article} = fetch(:post)
  """

  alias GroupherServer.CMS

  alias CMS.Gate.{Config, ErrorCat}
  alias CMS.Model.Article

  @article_threads Config.article_threads()

  @doc "Returns the canonical Article schema for a resource thread."
  @spec fetch(atom()) :: {:ok, module()} | {:error, ErrorCat.error()}
  def fetch(thread) when is_atom(thread) do
    if thread in @article_threads do
      {:ok, Article}
    else
      {:error, ErrorCat.scope_context_missing()}
    end
  end

  def fetch(_thread), do: {:error, ErrorCat.scope_context_missing()}

  @doc "Returns the resource thread represented by a canonical Article schema."
  @spec thread_for(module()) :: {:ok, atom()} | {:error, ErrorCat.error()}
  def thread_for(Article), do: {:error, ErrorCat.scope_context_missing()}
  def thread_for(_schema), do: {:error, ErrorCat.scope_root_mismatch()}
end
