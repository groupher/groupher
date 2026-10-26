defmodule GroupherServer.CMS.Articles.Commands.DiscardDraft do
  @moduledoc """
  Discards only the mutable workspace of a published stable Article.

      CMS.Articles.discard_draft
        -> DiscardDraft.execute
        -> Gate -> Draft.Store.discard
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat

  alias Accounts.Model.User
  alias CMS.Articles.Draft.Store
  alias CMS.Model.{Article, Community}

  @pipeline operation: :article_discard_draft, target: :article_id, params: :opts
  direct_pipeline execute_pipeline(article_id, actor, opts) do
    prepare(fn ->
      with {:ok, article} <- stable_article(article_id),
           {:ok, community} <- explicit_community(opts) do
        {:ok, {article, community}}
      end
    end)

    gate(fn {article, community} ->
      CMS.Gate.check_in_transaction(actor, :discard_draft, article, community)
    end)

    change(fn canonical -> Store.discard_loaded(canonical, opts) end)
  end

  @spec execute(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, :done} | {:error, term()}
  def execute(article_id, %User{} = actor, opts) when is_binary(article_id) do
    execute_pipeline(article_id, actor, opts)
  end

  def execute(_article_id, _actor, _opts) do
    {:error, ArticleErrorCat.invalid_command_input()}
  end

  defp stable_article(article_id) do
    case CMS.FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _} -> {:error, ArticleErrorCat.article_not_found()}
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
      _ -> {:error, ArticleErrorCat.binding_not_found()}
    end
  end

  defp community_by_id(_community_id) do
    {:error, ArticleErrorCat.binding_context_required()}
  end
end
