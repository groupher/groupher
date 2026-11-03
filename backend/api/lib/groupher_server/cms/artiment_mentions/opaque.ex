defmodule GroupherServer.CMS.ArtimentMentions.Opaque do
  @moduledoc """
  Signs public Map identities using purpose-separated HMAC digests.

      stable resource key -> keyed digest -> public node, edge or revision ID
  """

  def version do
    version = Application.fetch_env!(:groupher_server, :reference_map_key_version)
    "v#{version}"
  end

  def id(purpose, community_id, stable_key)
      when purpose in [:node, :edge, :revision, :cursor, :branch] and
             is_integer(community_id) do
    current_version = version()
    payload = :erlang.term_to_binary({current_version, purpose, community_id, stable_key})

    :crypto.mac(:hmac, :sha256, key(), payload)
    |> Base.url_encode64(padding: false)
    |> then(&"#{current_version}_#{&1}")
  end

  defp key do
    case Application.get_env(:groupher_server, :reference_map_key) do
      value when is_binary(value) and byte_size(value) >= 32 -> value
      _ -> raise "Reference Map signing key is not configured"
    end
  end
end
