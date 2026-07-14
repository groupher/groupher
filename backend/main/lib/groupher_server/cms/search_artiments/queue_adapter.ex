defmodule GroupherServer.CMS.SearchArtiments.QueueAdapter do
  @moduledoc "Contract for persistent Search Artiments indexing queues."

  @type job :: {module(), atom(), [term()]}

  @callback enqueue(job()) :: {:ok, :pass}
end
