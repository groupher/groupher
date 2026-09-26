defmodule GroupherServer.CMS.ViewTracker.Identity do
  @moduledoc """
  Normalizes request identity for ViewTracker.

  Browser fingerprints are intentionally not used. RequestActor owns the
  shared classification; this module derives the ViewTracker-only tracking
  key and combines it with that classification for the event recorder.

      request credentials -> RequestActor -> Identity -> ViewTracker policy
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.ViewTracker.ErrorCat
  alias GroupherServer.RequestActor
  alias GroupherServer.RequestActor.Classification

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
  def resolve(%User{id: user_id} = user, opts) do
    opts
    |> Keyword.put(:user, user)
    |> resolve_classification(user_id)
  end

  def resolve(nil, opts) do
    resolve_classification(opts, nil)
  end

  defp resolve_classification(opts, user_id) do
    with {:ok, %Classification{} = classification} <- RequestActor.classify(opts),
         {:ok, viewer_tracking_key} <- viewer_tracking_key(classification, user_id, opts) do
      {:ok,
       %{
         actor_type: classification.type,
         is_authenticated: classification.is_authenticated,
         actor_confidence: classification.confidence,
         classified_by: classification.classified_by,
         user_id: user_id,
         viewer_tracking_key: viewer_tracking_key
       }}
    else
      {:error, :conflicting_signals} -> {:error, ErrorCat.invalid_actor_type()}
      {:error, _reason} = error -> error
    end
  end

  defp viewer_tracking_key(%Classification{type: :unknown}, _user_id, _opts), do: {:ok, nil}

  defp viewer_tracking_key(%Classification{type: :human, is_authenticated: true}, user_id, _opts),
    do: {:ok, tracking_key("user:#{user_id}")}

  defp viewer_tracking_key(%Classification{type: :human}, _user_id, opts),
    do: signed_key(opts, :anonymous_id, "anonymous")

  defp viewer_tracking_key(%Classification{type: :agent}, _user_id, opts) do
    case Keyword.get(opts, :agent_credential_id) do
      value when is_binary(value) and byte_size(value) > 0 ->
        {:ok, tracking_key("agent:#{value}")}

      _ ->
        signed_key(opts, :delegation_id, "agent")
    end
  end

  defp viewer_tracking_key(%Classification{type: :crawler}, _user_id, opts),
    do: signed_key(opts, :crawler_family, "crawler")

  defp signed_key(opts, key, prefix) do
    case Keyword.get(opts, key) do
      value when is_binary(value) and byte_size(value) > 0 ->
        {:ok, tracking_key("#{prefix}:#{value}")}

      _ ->
        {:error, ErrorCat.invalid_actor_type()}
    end
  end

  defp tracking_key(value) do
    pepper = Application.fetch_env!(:groupher_server, :view_tracker_pepper)
    :crypto.mac(:hmac, :sha256, pepper, value)
  end
end
