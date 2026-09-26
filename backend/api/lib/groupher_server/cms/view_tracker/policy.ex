defmodule GroupherServer.CMS.ViewTracker.Policy do
  @moduledoc """
  Evaluates actor-specific eligibility for one explicit Article read.

      RequestActor identity + read purpose -> Policy -> counted or excluded
  """

  alias GroupherServer.CMS.ViewTracker.ErrorCat

  @policy_version 1

  @doc "Returns the current policy decision for a normalized identity."
  @spec evaluate(map(), keyword()) :: {:ok, map()} | {:error, atom()}
  def evaluate(identity, opts) when is_map(identity) and is_list(opts) do
    with {:ok, read_purpose} <- Keyword.fetch(opts, :read_purpose),
         true <-
           read_purpose in [
             :public_read,
             :author_preview,
             :moderation_review,
             :operations_inspection,
             :internal_probe
           ] do
      counted? = read_purpose == :public_read and eligible_actor?(identity)

      {:ok,
       %{
         counted: counted?,
         read_purpose: read_purpose,
         decision_reason: if(counted?, do: :counted, else: :excluded_by_policy),
         policy_version: @policy_version
       }}
    else
      :error -> {:error, ErrorCat.missing_read_purpose()}
      false -> {:error, ErrorCat.invalid_read_purpose()}
    end
  end

  defp eligible_actor?(%{
         actor_type: :human,
         actor_confidence: confidence,
         viewer_tracking_key: key
       })
       when confidence in [:verified, :probable] and is_binary(key),
       do: true

  defp eligible_actor?(%{
         actor_type: :agent,
         actor_confidence: :verified,
         viewer_tracking_key: key
       })
       when is_binary(key),
       do: true

  defp eligible_actor?(_identity), do: false
end
