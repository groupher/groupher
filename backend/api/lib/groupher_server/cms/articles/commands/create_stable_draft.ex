defmodule GroupherServer.CMS.Articles.Commands.CreateStableDraft do
  @moduledoc """
  Creates a stable Article Draft aggregate for the legacy Docs branch workflow.

      CMS.Articles.Commands.Create(:doc)
        -> create_in_transaction
        -> Draft.Store.create

  This module is an internal Docs builder; it is not an ordinary Article
  command and exposes no Receipt operation.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.{Articles, Articles.Draft.Store}
  alias CMS.Model.Author

  @doc false
  def create_in_transaction(community, thread, attrs, actor, opts) do
    with {:ok, author} <- target_author(actor) do
      Store.create(community, thread, attrs, author, Keyword.delete(opts, :command_id))
    end
  end

  defp target_author(%User{} = user), do: Articles.Persist.ensure_author_exists(user)
  defp target_author(%Author{} = author), do: {:ok, author}
end
