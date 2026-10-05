defmodule GroupherServer.CMS.Articles.Commands.CreateStableDraft do
  @moduledoc """
  Creates the stable Article aggregate and its first mutable Draft workspace.

      CMS.Articles.create_stable_draft
        -> CreateStableDraft.execute
        -> Draft.Store.create
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Articles
  alias GroupherServer.CMS.Articles.Draft.Store
  alias GroupherServer.CMS.Model.{Author, Community}

  @spec execute(Community.t(), atom(), map(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def execute(%Community{} = community, thread, attrs, actor, opts) do
    with {:ok, author} <- target_author(actor) do
      Store.create(community, thread, attrs, author, opts)
    end
  end

  defp target_author(%Author{} = author), do: {:ok, author}
  defp target_author(%User{} = user), do: Articles.Writer.ensure_author_exists(user)
  defp target_author(_actor), do: {:error, :invalid_actor}
end
