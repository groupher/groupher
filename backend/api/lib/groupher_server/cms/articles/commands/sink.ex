defmodule GroupherServer.CMS.Articles.Commands.Sink do
  @moduledoc """
  Sinks an Article through the explicit one-shot command boundary.

  The state transition is intentionally convergent and does not use a Receipt;
  the transport identity is validated before the Gate/state transition runs.

      commandId -> Sink -> Gate -> Article sink transition
  """

  alias GroupherServer.CMS
  alias CMS.Articles.Commands.StateChange
  alias CMS.Command.Receipt
  alias GroupherServer.Accounts.Model.User

  @spec execute(Ecto.UUID.t(), User.t(), keyword(), Ecto.UUID.t()) ::
          {:ok, term()} | {:error, term()}
  def execute(article_id, %User{} = actor, opts, command_id) when is_list(opts) do
    with {:ok, _command_id} <- Receipt.validate_command_id(command_id) do
      StateChange.execute(:sink, article_id, actor, Keyword.put(opts, :command_id, command_id))
    end
  end
end
