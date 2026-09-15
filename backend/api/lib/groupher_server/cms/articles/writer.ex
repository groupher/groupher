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

  alias GroupherServer.{Accounts, CMS, Messaging, Repo}

  alias Accounts.Model.User
  alias CMS.FrontDesk
  alias CMS.Model.Author
  alias Helper.{ORM, T}

  @doc "Notifies community administrators after the first official Article publish."
  @spec notify_admin_new_article(map()) :: T.domain_res(term())
  def notify_admin_new_article(%{target: target, id: id}) when is_atom(target) do
    do_notify_admin_new_article(target, id)
  end

  @doc false
  def notify_admin_new_article(%{__struct__: target, id: id}) do
    do_notify_admin_new_article(target, id)
  end

  defp do_notify_admin_new_article(target, id) do
    preload = [:community, author: :user]

    with {:ok, article} <- FrontDesk.get(target, id, preload: preload) do
      info = %{
        id: article.id,
        title: article.title,
        digest: Map.get(article, :digest, article.title),
        author_name: article.author.user.nickname,
        community_slug: article.community.slug,
        type: target |> to_string() |> String.split(".") |> List.last() |> String.downcase()
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
