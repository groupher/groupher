defmodule GroupherServer.CMS.Gate.Scope.ArticleSchema do
  @moduledoc """
  Resolves the concrete Article schema for a stable CMS thread.

  Business position:

      Gate Scope context
        -> ArticleSchema
        -> root schema validation

  Examples:

      iex> {:ok, GroupherServer.CMS.Model.Post} = fetch(:post)
      iex> {:ok, :post} = thread_for(GroupherServer.CMS.Model.Post)
  """

  alias GroupherServer.CMS
  alias CMS.Artiment.Matcher
  alias CMS.Gate
  alias CMS.Gate.Config
  alias Gate.ErrorCat

  @article_threads Config.article_threads()

  @doc "Returns the canonical Article schema for a resource thread."
  @spec fetch(atom()) :: {:ok, module()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def fetch(thread) when is_atom(thread) do
    case Matcher.match_interaction(thread) do
      {:ok, %{artiment: artiment, model: model}}
      when artiment in @article_threads ->
        {:ok, model}

      _ ->
        {:error, ErrorCat.scope_context_missing()}
    end
  end

  def fetch(_thread), do: {:error, ErrorCat.scope_context_missing()}

  @doc "Returns the resource thread represented by a canonical Article schema."
  @spec thread_for(module()) :: {:ok, atom()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def thread_for(schema) when is_atom(schema) do
    case Matcher.match_interaction(schema) do
      {:ok, %{artiment: artiment}} when artiment in @article_threads ->
        {:ok, artiment}

      _ ->
        {:error, ErrorCat.scope_root_mismatch()}
    end
  end
end
