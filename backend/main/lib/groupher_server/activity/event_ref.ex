defmodule GroupherServer.Activity.EventRef do
  @moduledoc """
  Derives deterministic UUID event identities from stable command data.

      operation identity -> deterministic digest -> event_ref UUID
  """

  import Bitwise

  @spec derive(term()) :: Ecto.UUID.t()
  def derive(identity) do
    digest =
      identity
      |> :erlang.term_to_binary([:deterministic])
      |> then(&:crypto.hash(:sha256, &1))

    <<time_low::32, time_mid::16, time_hi::16, clock_seq::16, node::48, _::binary>> = digest
    time_hi = (time_hi &&& 0x0FFF) ||| 0x5000
    clock_seq = (clock_seq &&& 0x3FFF) ||| 0x8000

    {:ok, uuid} =
      Ecto.UUID.load(<<time_low::32, time_mid::16, time_hi::16, clock_seq::16, node::48>>)

    uuid
  end
end
