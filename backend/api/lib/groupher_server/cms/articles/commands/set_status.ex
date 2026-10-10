defmodule GroupherServer.CMS.Articles.Commands.SetStatus do
  @moduledoc """
  Sets an Article's status through the explicit one-shot command boundary.

  Status changes converge on the current Article projection, so they do not
  require a Receipt. The caller-provided command identity is validated at this
  boundary and remains the identity for any future status effects.

      commandId -> SetStatus -> Gate -> Article status transition
  """

  alias GroupherServer.CMS
  alias CMS.Articles.Commands.StateChange
  alias CMS.Command.Receipt
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User

  @spec execute(map(), atom() | nil, User.t(), Community.t(), Ecto.UUID.t()) ::
          {:ok, Article.t()} | {:error, term()}
  def execute(
        %{id: _article_id} = article,
        status,
        %User{} = actor,
        %Community{} = community,
        command_id
      ) do
    with {:ok, _command_id} <- Receipt.validate_command_id(command_id) do
      StateChange.set_status_in_community(article, status, actor, community)
    end
  end
end
