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
  alias GroupherServer.CMS.Model.{Article, Community}

  @spec execute(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, :done} | {:error, term()}
  def execute(article_id, %User{} = actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, community} <- explicit_community(opts) do
      CMS.Gate.with_community_check(
        actor,
        :discard_draft,
        community,
        article,
        fn canonical ->
          case Store.discard(canonical, opts) do
            {:ok, _} -> {:ok, :done}
            {:error, reason} -> {:error, reason}
          end
        end
      )
    end
  end

  defp stable_article(article_id) do
    case CMS.FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _} -> {:error, :article_not_found}
    end
  end

  defp explicit_community(opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community -> {:ok, community}
      _ -> community_by_id(Keyword.get(opts, :community_id))
    end
  end

  defp community_by_id(community_id) when is_integer(community_id) do
    case CMS.FrontDesk.community(community_id, mode: :internal) do
      {:ok, %Community{} = community} -> {:ok, community}
      _ -> {:error, :article_binding_not_found}
    end
  end

  defp community_by_id(_community_id), do: {:error, :article_binding_context_required}
end
