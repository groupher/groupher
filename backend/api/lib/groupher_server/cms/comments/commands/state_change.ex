defmodule GroupherServer.CMS.Comments.Commands.StateChange do
  @moduledoc """
  Applies one independent Comment state change to a canonical resource.

      state command -> canonical Comment -> state transition -> tagged result
  """

  alias GroupherServer.CMS.Comments.States
  alias GroupherServer.CMS.Model.Comment
  alias GroupherServer.Accounts.Model.User

  @spec execute(atom(), Comment.t(), User.t()) :: {:ok, term()} | {:error, term()}
  def execute(action, %Comment{} = comment, %User{} = user)
      when action in [:pin, :undo_pin, :fold, :unfold] do
    apply(States, action, [comment, user])
  end
end
