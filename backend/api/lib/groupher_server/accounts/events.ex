defmodule GroupherServer.Accounts.Events do
  @moduledoc """
  Small account-domain event dispatcher.

  Account write paths emit semantic events such as follow/undo-follow here, then
  notification handlers decide what downstream messages should be created.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Events
        -> Repo
  """

  alias GroupherServer.ErrorCat

  @type event_result :: {:ok, map()} | {:error, any()}

  @spec emit(atom(), map()) :: event_result()
  @doc "Runs `emit` through the public `Events` boundary."
  def emit(:follow, %{user: user, from_user: from_user}) do
    __MODULE__.Notify.handle(:follow, user, from_user)
  end

  def emit(:undo_follow, %{user: user, from_user: from_user}) do
    __MODULE__.Notify.handle(:undo, :follow, user, from_user)
  end

  def emit(type, _payload), do: {:error, ErrorCat.custom("invalid account event: #{type}")}
end
