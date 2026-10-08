defmodule GroupherServer.CMS.Articles.Commands.Moderate do
  @moduledoc """
  Owns Gate admission for Article moderation state changes.

      moderation command -> canonical Article -> Gate -> moderation write
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.{Bindings, Moderation}
  alias CMS.Docs.Store, as: DocStore
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.{Article, Community, DocBranch}

  @spec execute(Ecto.UUID.t(), atom(), map(), struct() | :operations, keyword()) ::
          {:ok, term()} | {:error, term()}
  def execute(article_id, state, attrs, actor, opts) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{thread: :doc} = article} ->
        with {:ok, community} <- resolve_community(opts, article) do
          branch_id = Keyword.get(opts, :branch_id) || main_branch_id(community.id)

          CMS.Gate.Access.with_branch_check(
            actor,
            :moderate,
            community,
            article,
            branch_id,
            fn canonical ->
              Moderation.set_state(canonical, state, attrs,
                branch_id: branch_id,
                community: community
              )
            end
          )
        end

      {:ok, %Article{} = article} ->
        with {:ok, community} <- resolve_community(opts, article) do
          CMS.Gate.Access.with_community_check(
            actor,
            :moderate,
            community,
            article,
            fn canonical ->
              Moderation.set_state(
                canonical,
                state,
                attrs,
                Keyword.put(opts, :community, community)
              )
            end
          )
        end

      {:error, _} ->
        {:error, GateErrorCat.resource_not_found()}
    end
  end

  defp resolve_community(opts, article) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        {:ok, community}

      _ ->
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) ->
            case Repo.get(Community, community_id) do
              %Community{} = community -> {:ok, community}
              _ -> {:error, :article_binding_not_found}
            end

          _ ->
            resolve_branch_community(opts, article)
        end
    end
  end

  defp resolve_branch_community(opts, article) do
    case Keyword.get(opts, :branch_id) do
      branch_id when is_integer(branch_id) ->
        with %DocBranch{community_id: community_id} <- Repo.get(DocBranch, branch_id),
             %Community{} = community <- Repo.get(Community, community_id) do
          {:ok, community}
        else
          _ -> {:error, :article_binding_not_found}
        end

      _ ->
        case Bindings.get(article, Map.get(article, :community)) do
          {:ok, %{community: community}} -> {:ok, community}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp main_branch_id(community_id) do
    case DocStore.branch(community_id, :main) do
      {:ok, %{id: branch_id}} -> branch_id
      {:error, _} -> nil
    end
  end
end
