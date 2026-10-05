defmodule GroupherServer.CMS.Articles.Commands.UpdateDraft do
  @moduledoc """
  Autosaves stable Article content with an optimistic Draft version guard.

      CMS.Articles.update_draft
        -> UpdateDraft.execute
        -> Gate -> Draft.Store.update
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias GroupherServer.CMS.Articles
  alias GroupherServer.CMS.Articles.Draft.Store
  alias GroupherServer.CMS.Model.{Article, Author}
  alias GroupherServer.FrontDesk, as: RootFrontDesk

  @spec execute(Ecto.UUID.t(), map(), User.t() | Author.t(), keyword()) ::
          {:ok, struct()} | {:error, term()}
  def execute(article_id, attrs, actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, author} <- target_author(actor) do
      CMS.Gate.Access.with_check(actor_user(actor), :edit, article, fn canonical ->
        Store.update(canonical, attrs, author, opts)
      end)
    end
  end

  defp target_author(%Author{} = author), do: {:ok, author}
  defp target_author(%User{} = user), do: Articles.Writer.ensure_author_exists(user)
  defp target_author(_actor), do: {:error, :invalid_actor}

  defp actor_user(%User{} = user), do: user
  defp actor_user(%Author{user: %User{} = user}), do: user

  defp actor_user(%Author{user_id: user_id}) do
    case RootFrontDesk.fresh_user(user_id) do
      {:ok, user} -> user
      _ -> nil
    end
  end

  defp stable_article(article_id) do
    case CMS.FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _} -> {:error, :article_not_found}
    end
  end
end
