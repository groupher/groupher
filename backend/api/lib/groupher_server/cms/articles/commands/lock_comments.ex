defmodule GroupherServer.CMS.Articles.Commands.LockComments do
  @moduledoc """
  Locks Article comments through the explicit one-shot command boundary.

      commandId -> LockComments -> Gate -> Article comment-lock transition
  """

  alias GroupherServer.CMS
  alias CMS.Articles.Commands.CommentLock
  alias CMS.Command.Receipt
  alias GroupherServer.Accounts.Model.User

  @spec execute(Ecto.UUID.t(), User.t(), keyword(), Ecto.UUID.t()) ::
          {:ok, term()} | {:error, term()}
  def execute(article_id, %User{} = actor, opts, command_id) when is_list(opts) do
    with {:ok, _command_id} <- Receipt.validate_command_id(command_id) do
      CommentLock.execute(
        article_id,
        actor,
        :lock_comments,
        Keyword.put(opts, :command_id, command_id)
      )
    end
  end
end
