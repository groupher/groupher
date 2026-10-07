defmodule GroupherServer.CMS.Comments.Commands.CreateComment do
  @moduledoc """
  Creates a Comment from a canonical Article target.

      Article target -> Comment writer -> tagged Comment result
  """

  alias GroupherServer.CMS.Comments.Writer
  alias GroupherServer.Accounts.Model.User

  @spec execute(atom(), map(), String.t(), User.t(), String.t() | nil) ::
          {:ok, map()} | {:error, term()}
  def execute(thread, article, body, %User{} = user, command_id) when is_map(article) do
    Writer.create(thread, article, body, user, command_id)
  end
end
