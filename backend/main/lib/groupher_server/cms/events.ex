defmodule GroupherServer.CMS.Events do
  @moduledoc """
  Facade and main entry point for CMS event-related functionality.

  This module provides a unified interface for working with CMS events so that
  other parts of the system do not need to know about individual event
  implementations or where they are defined. By routing event operations
  through this module, callers can:

    * trigger handlers associated with CMS events
    * keep event-related logic encapsulated behind a stable API
    * centralize cross-cutting behavior that should run when CMS events occur

  In typical usage, higher-level CMS contexts or services call functions
  exposed by this module instead of invoking event modules directly. This helps
  maintain a clear boundary for event behavior and makes it easier to evolve
  or reconfigure events without touching the rest of the codebase.
  """

  alias GroupherServer.CMS
  alias CMS.Events.Event

  @type event_result :: {:ok, term()} | {:error, term()}

  @spec emit(atom(), map(), map()) :: event_result()
  def emit(type, payload, meta \\ %{}) when is_atom(type) and is_map(payload) and is_map(meta) do
    event = %Event{type: type, payload: payload, meta: meta}

    with {:ok, module} <- route(type) do
      module.handle(event)
    end
  end

  @spec route(atom()) :: {:ok, module()} | {:error, term()}
  defp route(:cite), do: {:ok, __MODULE__.Cite}
  defp route(:mention), do: {:ok, __MODULE__.Mention}
  defp route(:audition), do: {:ok, __MODULE__.Audition}
  defp route(:subscribe_community), do: {:ok, __MODULE__.SubscribeCommunity}

  defp route(type)
       when type in [
              :notify_comment,
              :notify_reply,
              :notify_upvote,
              :notify_collect,
              :notify_undo_upvote,
              :notify_undo_collect
            ] do
    {:ok, __MODULE__.Notify}
  end

  defp route(type), do: {:error, {:invalid_event_type, type}}
end
