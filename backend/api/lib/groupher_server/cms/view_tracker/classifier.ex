defmodule GroupherServer.CMS.ViewTracker.Classifier do
  @moduledoc """
  Classifies trusted authenticated and anonymous request identities.

  The module owns classification semantics; the platform-level actor vocabulary
  remains in GroupherServer.Actor.Const.

      request credentials -> Classifier -> actor type / confidence / tracking key
  """

  alias GroupherServer.Actor.Const, as: ActorConst
  alias GroupherServer.CMS.ViewTracker.{Const, ErrorCat}

  @doc "Classifies an authenticated user or agent credential."
  @spec authenticated(pos_integer(), keyword()) :: {:ok, map()} | {:error, atom()}
  def authenticated(user_id, opts) when is_integer(user_id) do
    case Keyword.get(opts, :actor_type, :human) do
      :human ->
        {:ok, human_identity(user_id)}

      :agent ->
        credential_identity(user_id, opts, :agent, :agent_credential_id)

      :crawler ->
        {:error, ErrorCat.invalid_actor_type()}

      _ ->
        {:error, ErrorCat.invalid_actor_type()}
    end
  end

  def authenticated(_user_id, _opts), do: {:error, ErrorCat.invalid_actor_type()}

  @doc "Classifies an anonymous request using only trusted server-side signals."
  @spec anonymous(keyword()) :: {:ok, map()} | :unknown | {:error, atom()}
  def anonymous(opts) do
    actor_type = Keyword.get(opts, :actor_type, :human)

    cond do
      actor_type == :human -> anonymous_human(opts)
      actor_type == :crawler -> known_crawler(opts)
      actor_type == :agent -> anonymous_agent(opts)
      ActorConst.valid_actor_type?(actor_type) -> :unknown
      true -> {:error, ErrorCat.invalid_actor_type()}
    end
  end

  @doc "Returns the fallback identity when no safe cross-request key exists."
  def unknown do
    %{
      actor_type: :unknown,
      is_authenticated: false,
      actor_confidence: :unknown,
      classified_by: :fallback,
      user_id: nil,
      viewer_tracking_key: nil
    }
  end

  defp human_identity(user_id) do
    %{
      actor_type: :human,
      is_authenticated: true,
      actor_confidence: :verified,
      classified_by: :account_session,
      user_id: user_id,
      viewer_tracking_key: tracking_key("user:#{user_id}")
    }
  end

  defp credential_identity(user_id, opts, actor_type, key_name) do
    with value when is_binary(value) and byte_size(value) > 0 <- Keyword.get(opts, key_name),
         classified_by <- Keyword.get(opts, :classified_by, default_classifier(actor_type)),
         confidence <- Keyword.get(opts, :actor_confidence, :verified),
         true <- classified_by in Const.classified_by(),
         true <- confidence in Const.actor_confidences() do
      {:ok,
       %{
         actor_type: actor_type,
         is_authenticated: true,
         actor_confidence: confidence,
         classified_by: classified_by,
         user_id: user_id,
         viewer_tracking_key: tracking_key("#{Atom.to_string(actor_type)}:#{value}")
       }}
    else
      _ -> {:error, ErrorCat.invalid_actor_type()}
    end
  end

  defp anonymous_human(opts) do
    case Keyword.get(opts, :anonymous_id) do
      value when is_binary(value) and byte_size(value) > 0 ->
        {:ok,
         %{
           actor_type: :human,
           is_authenticated: false,
           actor_confidence: :probable,
           classified_by: :signed_anonymous_id,
           user_id: nil,
           viewer_tracking_key: tracking_key("anonymous:#{value}")
         }}

      _ ->
        :unknown
    end
  end

  defp known_crawler(opts) do
    case Keyword.get(opts, :crawler_family) do
      family when is_binary(family) and byte_size(family) > 0 ->
        {:ok,
         %{
           actor_type: :crawler,
           is_authenticated: false,
           actor_confidence: :verified,
           classified_by: :verified_crawler,
           user_id: nil,
           viewer_tracking_key: tracking_key("crawler:#{family}")
         }}

      _ ->
        {:error, ErrorCat.invalid_actor_type()}
    end
  end

  defp anonymous_agent(opts) do
    {value, classified_by} =
      case Keyword.get(opts, :agent_credential_id) do
        value when is_binary(value) and byte_size(value) > 0 -> {value, :agent_credential}
        _ -> {Keyword.get(opts, :delegation_id), :delegation_credential}
      end

    case value do
      value when is_binary(value) and byte_size(value) > 0 ->
        {:ok,
         %{
           actor_type: :agent,
           is_authenticated: false,
           actor_confidence: :verified,
           classified_by: classified_by,
           user_id: nil,
           viewer_tracking_key: tracking_key("agent:#{value}")
         }}

      _ ->
        {:error, ErrorCat.invalid_actor_type()}
    end
  end

  defp default_classifier(:agent), do: :agent_credential

  defp tracking_key(value) do
    pepper = Application.fetch_env!(:groupher_server, :view_tracker_pepper)
    :crypto.mac(:hmac, :sha256, pepper, value)
  end
end
