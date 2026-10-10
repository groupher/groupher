defmodule GroupherServer.CMS.Comments.Commands.ReplyComment do
  @moduledoc """
  Creates a reply from a canonical parent Comment target.

      parent Comment -> reply writer -> tagged Comment result
  """

  alias GroupherServer.CMS.Comments.Writer
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Comment

  @spec execute(Comment.t(), String.t(), User.t(), String.t() | nil) ::
          {:ok, map()} | {:error, term()}
  def execute(%Comment{} = comment, body, %User{} = user, command_id) do
    Writer.reply(comment, body, user, command_id)
  end
end
