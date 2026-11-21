defmodule GroupherServer.CMS.Gate.RateLimit.Publish do
  @moduledoc """
  Gate facade for publish frequency admission and accounting.

  Business position:

      CMS operation
        -> CMS.Gate
        -> RateLimit.Publish
        -> allow / deny
        -> domain context

  Examples:

      iex> {:ok, :publish} = check(%{id: 1, cur_passport: %{}})
      iex> {:ok, _record} = record(%GroupherServer.Accounts.Model.User{id: 1})
  """

  @doc """
  Checks whether the actor may publish within the configured limits.

  ## Examples

      Publish.check(user, interval: 3)
      #=> {:ok, :publish} | {:error, error}
  """
  defdelegate check(user, opts \\ []), to: __MODULE__.Workflow

  @doc "Checks publish limits in the caller's existing transaction."
  defdelegate check_in_transaction(user, opts \\ []), to: __MODULE__.Workflow

  @doc """
  Records a successful publish for the actor.

  ## Examples

      Publish.record(user)
      #=> {:ok, %Publish.Model.PublishThrottle{}}
  """
  defdelegate record(user), to: __MODULE__.Workflow

  @doc """
  Loads the actor throttle record and resets expired hour/day windows.

  ## Examples

      Publish.load_and_reset(user)
      #=> {:ok, %Publish.Model.PublishThrottle{}}
  """
  defdelegate load_and_reset(user), to: __MODULE__.Workflow

  @doc false
  defdelegate mock_publish_throttle_attr(attribute, user, options), to: __MODULE__.Workflow
end
