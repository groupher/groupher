defmodule GroupherServer.AI.Adapters do
  @moduledoc """
  Registry for the provider adapters supported by AI.

      operator profile
        -> Adapters.fetch/1
        -> provider adapter module
        -> validated OpinionOutput
  """

  @adapters %{
    judge_http: GroupherServer.AI.Adapters.JudgeHTTP,
    openai: GroupherServer.AI.Adapters.OpenAI
  }

  @doc """
  Returns whether a configured provider adapter is supported.

  ## Examples

      Adapters.supported?(:openai)
      #=> true
  """
  @spec supported?(term()) :: boolean()
  def supported?(adapter), do: Map.has_key?(@adapters, adapter)

  @doc """
  Resolves a configured provider adapter.

  ## Examples

      Adapters.fetch(:judge_http)
      #=> {:ok, GroupherServer.AI.Adapters.JudgeHTTP}
  """
  @spec fetch(term()) :: {:ok, module()} | :error
  def fetch(adapter), do: Map.fetch(@adapters, adapter)
end
