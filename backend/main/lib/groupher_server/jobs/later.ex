defmodule GroupherServer.Jobs.Later do
  @moduledoc """
  Compatibility job for legacy fire-and-forget function calls.
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:later),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:later)

  alias GroupherServer.Jobs.Codec

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"job" => encoded}}) do
    {mod, func, args} = Codec.decode(encoded)
    apply(mod, func, args)
  end
end
