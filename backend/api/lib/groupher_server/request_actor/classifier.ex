defmodule GroupherServer.RequestActor.Classifier do
  @moduledoc """
  Maps one internally selected evidence variant into the shared immutable
  request classification.

      Evidence variant
        -> RequestActor.Classifier
        -> Classification
  """

  alias GroupherServer.RequestActor
  alias RequestActor.{Classification, Evidence}

  @spec classify(Evidence.t()) :: Classification.t()
  def classify(%Evidence.Delegation{delegation: %{user_actor: user}}) do
    classification(:agent, not is_nil(user), :verified, :delegation_credential)
  end

  def classify(%Evidence.ServiceCredential{}) do
    classification(:agent, false, :verified, :agent_credential)
  end

  def classify(%Evidence.AccountSession{}) do
    classification(:human, true, :verified, :account_session)
  end

  def classify(%Evidence.VerifiedCrawler{}) do
    classification(:crawler, false, :verified, :verified_crawler)
  end

  def classify(%Evidence.SignedAnonymousSession{}) do
    classification(:human, false, :probable, :signed_anonymous_session)
  end

  def classify(%Evidence.Unknown{classified_by: :self_reported}) do
    classification(:unknown, false, :probable, :self_reported)
  end

  def classify(%Evidence.Unknown{}) do
    classification(:unknown, false, :unknown, :fallback)
  end

  defp classification(type, is_authenticated, confidence, classified_by) do
    %Classification{
      type: type,
      is_authenticated: is_authenticated,
      confidence: confidence,
      classified_by: classified_by
    }
  end
end
