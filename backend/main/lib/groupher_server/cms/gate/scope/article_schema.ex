defmodule GroupherServer.CMS.Gate.Scope.ArticleSchema do
  @moduledoc """
  Resolves the concrete Article schema for a stable CMS thread.

  Business position:

      Gate Scope context
        -> ArticleSchema
        -> root schema validation
  """

  alias GroupherServer.CMS.Interactions.Registry

  @spec fetch(atom()) :: {:ok, module()} | {:error, :scope_context_missing}
  def fetch(thread) when is_atom(thread) do
    try do
      {:ok, Registry.article_schema(thread)}
    rescue
      KeyError -> {:error, :scope_context_missing}
    end
  end

  def fetch(_thread), do: {:error, :scope_context_missing}

  @spec thread_for(module()) :: {:ok, atom()} | {:error, :scope_root_mismatch}
  def thread_for(schema) when is_atom(schema) do
    case Registry.thread_for(schema) do
      {:ok, thread} -> {:ok, thread}
      :error -> {:error, :scope_root_mismatch}
    end
  end
end
