defmodule GroupherServer.CMS.ViewTracker.Policy do
  @moduledoc """
  Evaluates the server-derived ViewTracker read purpose.

      trusted read context -> Policy -> counted or terminal excluded event
  """

  alias GroupherServer.CMS.ViewTracker.ErrorCat

  @policy_version 1

  @doc "Returns the current policy decision for a normalized identity."
  @spec evaluate(map(), keyword()) :: {:ok, map()} | {:error, atom()}
  def evaluate(_identity, opts) when is_list(opts) do
    with {:ok, read_purpose} <- Keyword.fetch(opts, :read_purpose),
         true <-
           read_purpose in [
             :public_read,
             :author_preview,
             :moderation_review,
             :operations_inspection,
             :internal_probe
           ] do
      counted? = read_purpose == :public_read

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
end
