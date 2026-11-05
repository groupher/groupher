defmodule GroupherServer.CMS.Snapshot.MemberRef do
  @moduledoc """
  Stable public snapshot membership identity independent of profile fields.

      persisted stable account id -> purpose-separated signature -> public membership ref
  """

  @doc "Signs a stable account identity without exposing the internal numeric id."
  def encode(%{id: id}) when is_integer(id) and id > 0 do
    endpoint = Application.fetch_env!(:groupher_server, GroupherServerWeb.Endpoint)
    key = Keyword.fetch!(endpoint, :secret_key_base)
    ref = :crypto.mac(:hmac, :sha256, key, :erlang.term_to_binary({:snapshot_member, id}))
    {:ok, Base.url_encode64(ref, padding: false)}
  end

  def encode(_member), do: {:error, :snapshot_member_identity_missing}
end
