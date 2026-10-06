defmodule GroupherServer.CMS.Articles.Commands.DiscardDraft do
  @moduledoc """
  Discards only the mutable workspace of a published stable Article.

      CMS.Articles.discard_draft
        -> DiscardDraft.execute
        -> Gate -> Draft.Store.discard
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias GroupherServer.CMS.Articles.Draft.Store
  alias GroupherServer.CMS.Model.Article

  @spec execute(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, :done} | {:error, term()}
  def execute(article_id, %User{} = actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id) do
      CMS.Gate.Access.with_check(actor, :discard_draft, article, fn canonical ->
        case Store.discard(canonical, opts) do
          :ok -> {:ok, :done}
          {:error, reason} -> {:error, reason}
        end
      end)
    end
  end

  defp stable_article(article_id) do
    case CMS.FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _} -> {:error, :article_not_found}
    end
  end
end
