defmodule GroupherServer.CMS.Articles.Effects do
  @moduledoc """
  Owns durable effect intents emitted by Article mutations.

  The caller owns the Article Command or Workflow transaction. This module
  records bounded Outbox intent; external delivery remains in the Article
  cleanup worker and its post-commit adapters.

      Article Command / Workflow
        -> Articles.Effects
        -> CMS.Outbox
        -> Article cleanup worker
  """

  alias GroupherServer.CMS
  alias CMS.Articles.Effects.{Outbox, Publish}

  @doc "Records one Article effect in the caller-owned transaction."
  @spec enqueue(String.t(), String.t(), term(), Ecto.UUID.t(), map()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  defdelegate enqueue(event, resource_type, resource_id, operation_ref, data), to: Outbox

  @doc "Records independent Press, Search and CDN intents for a committed Article event."
  defdelegate dispatch(event), to: Outbox

  @doc "Executes one typed Article effect after its Outbox event is claimed."
  @spec run(map()) :: {:ok, term()} | {:error, term()}
  defdelegate run(effect), to: Publish

  @doc "Records one Article activity in the caller-owned transaction."
  defdelegate activity(resource, event, opts), to: Outbox
end
