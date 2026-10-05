defmodule GroupherServer.CMS.ViewTracker.Identity do
  @moduledoc """
  Derives the ViewTracker-only identity from one request-scoped classification.

  Browser fingerprints are intentionally not used. RequestActor classifies
  once at the request boundary; this module only derives a stable HMAC key from
  the corresponding trusted account, anonymous session, service, delegation,
  or crawler handle.

      RequestActor.Classification + trusted identity handle
        -> ViewTracker.Identity
        -> HMAC viewer_tracking_key + actor dimensions
  """

  alias GroupherServer.{Accounts, CMS, RequestActor}
  alias Accounts.Model.User
  alias CMS.ViewTracker.{AnonymousSession, ErrorCat}
  alias RequestActor.Classification

  @type t :: %{
          actor_type: atom(),
          is_authenticated: boolean(),
          actor_confidence: atom(),
          classified_by: atom(),
          user_id: pos_integer() | nil,
          viewer_tracking_key: binary() | nil
        }

  @doc """
  Builds the ViewTracker identity for one already-classified request.

  Only the trusted handle selected by `RequestActor` may contribute to the
  tracking key. The key is an HMAC rather than a raw account, session, service,
  delegation, or crawler identifier. Unknown actors intentionally receive no
  tracking key and cannot enter counted-view deduplication.
  """
  @spec resolve(User.t() | nil, Classification.t(), keyword()) :: {:ok, t()} | {:error, term()}
  def resolve(viewer, %Classification{} = classification, opts) when is_list(opts) do
    user_id = if match?(%User{}, viewer), do: viewer.id, else: nil

    with {:ok, viewer_tracking_key} <- viewer_tracking_key(classification, viewer, opts) do
      {:ok,
       %{
         actor_type: classification.type,
         is_authenticated: classification.is_authenticated,
         actor_confidence: classification.confidence,
         classified_by: classification.classified_by,
         user_id: user_id,
         viewer_tracking_key: viewer_tracking_key
       }}
    end
  end

  def resolve(_viewer, _classification, _opts), do: {:error, ErrorCat.invalid_actor_type()}

  defp viewer_tracking_key(%Classification{type: :unknown}, _viewer, _opts), do: {:ok, nil}

  defp viewer_tracking_key(
         %Classification{type: :human, is_authenticated: true},
         %User{id: user_id},
         _opts
       ) do
    {:ok, tracking_key("user:#{user_id}")}
  end

  defp viewer_tracking_key(%Classification{type: :human}, _viewer, opts) do
    case Keyword.get(opts, :anonymous_session) do
      %AnonymousSession{id: id} -> {:ok, tracking_key("anonymous:#{id}")}
      _ -> {:error, ErrorCat.invalid_actor_type()}
    end
  end

  defp viewer_tracking_key(
         %Classification{type: :agent, classified_by: :agent_credential},
         _viewer,
         opts
       ) do
    with credential when is_map(credential) <- Keyword.get(opts, :service_credential),
         {:ok, id} <- service_credential_id(credential) do
      {:ok, tracking_key("agent:#{id}")}
    else
      _ -> {:error, ErrorCat.invalid_actor_type()}
    end
  end

  defp viewer_tracking_key(
         %Classification{type: :agent, classified_by: :delegation_credential},
         _viewer,
         opts
       ) do
    case Keyword.get(opts, :delegation) do
      %{service_actor: credential, user_actor: %User{id: user_id}} ->
        with {:ok, credential_id} <- service_credential_id(credential) do
          {:ok, tracking_key("delegation:#{credential_id}:#{user_id}")}
        end

      _ ->
        {:error, ErrorCat.invalid_actor_type()}
    end
  end

  defp viewer_tracking_key(%Classification{type: :crawler}, _viewer, opts) do
    case Keyword.get(opts, :crawler) do
      %{family: family} when is_binary(family) and byte_size(family) > 0 ->
        {:ok, tracking_key("crawler:#{family}")}

      _ ->
        {:error, ErrorCat.invalid_actor_type()}
    end
  end

  defp viewer_tracking_key(_classification, _viewer, _opts) do
    {:error, ErrorCat.invalid_actor_type()}
  end

  defp service_credential_id(%{token_id: id}) when is_binary(id) and byte_size(id) > 0 do
    {:ok, id}
  end

  defp service_credential_id(%{subject: subject})
       when is_binary(subject) and byte_size(subject) > 0 do
    {:ok, subject}
  end

  defp service_credential_id(_credential), do: {:error, ErrorCat.invalid_actor_type()}

  defp tracking_key(value) do
    pepper = Application.fetch_env!(:groupher_server, :view_tracker_pepper)
    :crypto.mac(:hmac, :sha256, pepper, value)
  end
end
