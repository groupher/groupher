defmodule GroupherServer.RequestActor.Crawler do
  @moduledoc """
  Verified crawler result produced by the platform request boundary.

  Cloudflare/provider verification is intentionally outside RequestActor; this
  value is only the bounded business object that a future verifier may return.

      future Edge crawler verifier
        -> RequestActor.Crawler
        -> Evidence.VerifiedCrawler
  """

  @enforce_keys [:family]
  defstruct [:family]

  @type t :: %__MODULE__{family: String.t()}
end
