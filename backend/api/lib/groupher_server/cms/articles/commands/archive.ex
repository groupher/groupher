defmodule GroupherServer.CMS.Articles.Commands.Archive do
  @moduledoc """
  Owns Article thread archive state routing.

      Article archive command -> Gate/state transition -> tagged result
  """

  alias GroupherServer.CMS.Articles.States

  @spec execute(atom()) :: {:ok, term()} | {:error, term()}
  def execute(thread), do: States.archive(thread)
end
