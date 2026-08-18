defmodule GroupherServer.CMS.Articles.Writer do
  @moduledoc """
  Publish-adjacent helpers that do not own Article content lifecycle.

  Draft/Publish own content writes. Trash owns soft deletion, restore and
  permanent deletion; this module only keeps Author creation and first-publish
  notification helpers used by those write paths.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Writer
        -> Repo / domain event
  """

  alias GroupherServer.{CMS, Messaging, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Model.Author
  alias CMS.FrontDesk
  alias Helper.{ORM, T}

  @doc "Notifies community administrators after the first official Article publish."
  @spec notify_admin_new_article(map()) :: T.domain_res(term())
  def notify_admin_new_article(%{id: id} = result) do
    target = result.__struct__
    preload = [:community, author: :user]

    with {:ok, article} <- FrontDesk.get(target, id, preload: preload) do
      info = %{
        id: article.id,
        title: article.title,
        digest: Map.get(article, :digest, article.title),
        author_name: article.author.user.nickname,
        community_slug: article.community.slug,
        type:
          result.__struct__
          |> to_string()
          |> String.split(".")
          |> List.last()
          |> String.downcase()
      }

      Messaging.notify(:notify_admin_new_article, info)
    end
  end

  @doc "Returns or creates the CMS Author row associated with a User."
  @spec ensure_author_exists(User.t()) :: {:ok, Author.t()}
  def ensure_author_exists(%User{} = user) do
    case ORM.find_by(Author, user_id: user.id) do
      {:ok, author} ->
        {:ok, author}

      {:error, _} ->
        %Author{user_id: user.id}
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.unique_constraint(:user_id)
        |> Ecto.Changeset.foreign_key_constraint(:user_id)
        |> Repo.insert()
    end
  end
end
