defmodule GroupherServer.CMS.Articles.Commands.SetCategory do
  @moduledoc """
  Sets the category of an Article through the explicit one-shot command boundary.

  Category changes converge on the current Article projection, so they do not
  require a Receipt. The caller-provided command identity is nevertheless
  validated at this boundary and is available to future effects.

      commandId -> SetCategory -> Gate -> Article category transition
  """

  alias GroupherServer.CMS
  alias CMS.Articles.Commands.StateChange
  alias CMS.Command.Receipt
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User

  @spec execute(Ecto.UUID.t(), atom() | nil, User.t(), Community.t(), Ecto.UUID.t()) ::
          {:ok, Article.t()} | {:error, term()}
  def execute(article_id, category, %User{} = actor, %Community{} = community, command_id) do
    with {:ok, _command_id} <- Receipt.validate_command_id(command_id) do
      StateChange.set_category(article_id, category, actor, community)
    end
  end
end
