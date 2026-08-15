defmodule GroupherServer.CMS.Gate.Scope.ArticleSchema do
  @moduledoc """
  Resolves the concrete Article schema for a stable CMS thread.

  Business position:

      Gate Scope context
        -> ArticleSchema
        -> root schema validation
  """

  alias GroupherServer.CMS.Model.{Blog, Changelog, Doc, Post}

  @schemas %{post: Post, blog: Blog, changelog: Changelog, doc: Doc}
  @threads Map.new(@schemas, fn {thread, schema} -> {schema, thread} end)

  @spec fetch(atom()) :: {:ok, module()} | {:error, :scope_context_missing}
  def fetch(thread) when is_atom(thread) do
    case Map.fetch(@schemas, thread) do
      {:ok, schema} -> {:ok, schema}
      :error -> {:error, :scope_context_missing}
    end
  end

  def fetch(_thread), do: {:error, :scope_context_missing}

  @spec thread_for(module()) :: {:ok, atom()} | {:error, :scope_root_mismatch}
  def thread_for(schema) when is_atom(schema) do
    case Map.fetch(@threads, schema) do
      {:ok, thread} -> {:ok, thread}
      :error -> {:error, :scope_root_mismatch}
    end
  end
end
