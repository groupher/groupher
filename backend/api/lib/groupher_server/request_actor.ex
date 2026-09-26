defmodule GroupherServer.RequestActor do
  @moduledoc """
  Classifies the trusted subject behind one request.

  RequestActor is a platform boundary. It returns only the actor category and
  classification metadata; ViewTracker owns tracking keys and counted policy.
  Callers provide verified request inputs, never a caller-selected actor type.

      trusted request inputs -> RequestActor.classify/1 -> Classification
  """

  alias GroupherServer.RequestActor.Classification

  @doc "Classifies one request from trusted identity and credential inputs."
  @spec classify(keyword()) :: {:ok, Classification.t()} | {:error, :conflicting_signals}
  def classify(opts) when is_list(opts) do
    if conflicting_signals?(opts) do
      {:error, :conflicting_signals}
    else
      classify_valid(opts)
    end
  end

  def classify(_opts), do: {:error, :conflicting_signals}

  defp classify_valid(opts) do
    cond do
      present?(Keyword.get(opts, :delegation_id)) ->
        {:ok,
         classification(
           :agent,
           Keyword.get(opts, :user) != nil,
           :verified,
           :delegation_credential
         )}

      present?(Keyword.get(opts, :agent_credential_id)) ->
        {:ok,
         classification(:agent, Keyword.get(opts, :user) != nil, :verified, :agent_credential)}

      Keyword.get(opts, :user) != nil ->
        {:ok, classification(:human, true, :verified, :account_session)}

      present?(Keyword.get(opts, :crawler_family)) ->
        {:ok, classification(:crawler, false, :verified, :verified_crawler)}

      present?(Keyword.get(opts, :anonymous_id)) ->
        {:ok, classification(:human, false, :probable, :signed_anonymous_session)}

      true ->
        {:ok, classification(:unknown, false, :unknown, :fallback)}
    end
  end

  defp conflicting_signals?(opts) do
    agent_signals =
      [Keyword.get(opts, :delegation_id), Keyword.get(opts, :agent_credential_id)]
      |> Enum.count(&present?/1)

    crawler? = present?(Keyword.get(opts, :crawler_family))
    anonymous? = present?(Keyword.get(opts, :anonymous_id))

    agent_signals > 1 or
      (crawler? and
         (agent_signals > 0 or anonymous? or Keyword.get(opts, :user) != nil))
  end

  defp classification(type, is_authenticated, confidence, classified_by) do
    %Classification{
      type: type,
      is_authenticated: is_authenticated,
      confidence: confidence,
      classified_by: classified_by
    }
  end

  defp present?(value), do: is_binary(value) and byte_size(value) > 0
end
