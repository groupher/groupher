defmodule GroupherServer.CMS.ViewTracker.Identity do
  @moduledoc """
  Normalizes request identity for ViewTracker.

  Browser fingerprints are intentionally not used. Classification semantics
  are delegated to Classifier; this module is the stable identity boundary
  consumed by the policy and event recorder.

      request credentials -> Identity -> Classifier -> normalized identity
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.ViewTracker.Classifier

  @type t :: %{
          actor_type: atom(),
          is_authenticated: boolean(),
          actor_confidence: atom(),
          classified_by: atom(),
          user_id: pos_integer() | nil,
          viewer_tracking_key: binary() | nil
        }

  @doc "Builds a server-side identity from a user or a signed anonymous value."
  @spec resolve(User.t() | nil, keyword()) :: {:ok, t()} | {:error, atom()}
  def resolve(%User{id: user_id}, opts), do: Classifier.authenticated(user_id, opts)

  def resolve(nil, opts) do
    case Classifier.anonymous(opts) do
      {:ok, identity} -> {:ok, identity}
      :unknown -> {:ok, Classifier.unknown()}
      {:error, _reason} = error -> error
    end
  end
end
