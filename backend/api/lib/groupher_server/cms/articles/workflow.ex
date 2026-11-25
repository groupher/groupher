defmodule GroupherServer.CMS.Articles.Workflow do
  @moduledoc """
  Shared Article transaction and author lookup helpers.

      Article lifecycle -> caller-owned transaction -> Repo
  """

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User

  alias CMS.Model.Author
  alias Helper.ORM

  @doc "Runs an Article workflow in the current transaction or opens one."
  def transaction(fun) when is_function(fun, 0) do
    if Repo.in_transaction?() do
      {:ok, fun.()}
    else
      Repo.transaction(fun)
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
