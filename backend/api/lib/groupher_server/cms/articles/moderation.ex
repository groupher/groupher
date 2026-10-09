defmodule GroupherServer.CMS.Articles.Moderation do
  @moduledoc """
  Article moderation helpers.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Moderation
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.{CMS, FrontDesk, Repo}

  alias CMS.Articles.Trash
  alias CMS.Communities.TagStats

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBindingTag,
    ArticlePublic,
    Community,
    CommunityTag,
    DocBranch,
    DocBranchState,
    DocPublic
  }

  alias CMS.SearchArtiments.Indexer
  alias Helper.{ORM, T}

  @doc """
  Returns a paged list of audit-failed articles for one thread.

  ## Examples

      CMS.Articles.Moderation.paged_audit_failed(:post, %{page: 1, size: 20})

  """
  @spec paged_audit_failed(atom(), map()) :: T.domain_res(term())
  def paged_audit_failed(thread, filter) do
    %{page: page, size: size} = filter

    Article
    |> Trash.not_trashed_scope(thread)
    |> where([article], article.thread == ^thread and article.moderation_state == :audit_failed)
    |> order_by([article], desc: article.updated_at)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  @doc "Applies one moderation state to a Gate-authorized stable Article."
  @spec set_state(Article.t(), atom(), map(), keyword()) :: T.domain_res(term())
  def set_state(%Article{thread: :doc} = article, state, audit_state, opts)
      when state in [:legal, :illegal, :audit_failed] do
    update_doc_moderation(article, state, audit_state, opts)
  end

  def set_state(%Article{} = article, state, audit_state, opts)
      when state in [:legal, :illegal, :audit_failed] do
    update_stable_moderation(article, state, audit_state, opts)
  end

  defp update_doc_moderation(article, state, audit_state, opts) do
    community =
      Keyword.get(opts, :community) ||
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) -> Repo.get(Community, community_id)
          _ -> nil
        end

    if not match?(%Community{}, community) do
      {:error, :article_binding_context_required}
    else
      update_doc_moderation_with_community(article, state, audit_state, opts, community)
    end
  end

  defp update_doc_moderation_with_community(article, state, audit_state, opts, community) do
    branch =
      case Keyword.get(opts, :branch_id) do
        nil -> Repo.get_by(DocBranch, community_id: community.id, type: :main)
        branch_id -> Repo.get_by(DocBranch, id: branch_id, community_id: community.id)
      end

    with %DocBranch{id: branch_id} <- branch,
         %DocBranchState{} = branch_state <-
           Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id) do
      with {:ok, updated} <-
             branch_state
             |> DocBranchState.changeset(doc_moderation_attrs(state, audit_state))
             |> Repo.update(),
           {:ok, _} <- update_doc_visibility(article.id, branch_id, state),
           {:ok, _} <- update_author_moderation(article, state, audit_state),
           {:ok, _} <- sync_stable_search(article, state) do
        {:ok, updated}
      end
    else
      nil -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
    end
  end

  defp update_stable_moderation(%Article{} = article, state, audit_state, opts) do
    with {:ok, updated} <-
           article
           |> Article.changeset(stable_moderation_attrs(state, audit_state))
           |> Repo.update(),
         {:ok, _} <- update_public_visibility(article.id, state),
         {:ok, _} <- update_author_moderation(article, state, audit_state),
         {:ok, _} <- rebuild_tag_stats(article.id),
         {:ok, _} <- sync_stable_search(updated, state),
         {:ok, _} <- invalidate_public_cache(updated, opts) do
      {:ok, updated}
    end
  end

  defp stable_moderation_attrs(state, audit_state) do
    %{
      moderation_state: state,
      illegal_reason:
        if(state == :legal, do: [], else: Map.get(audit_state, :illegal_reason, [])),
      illegal_words: if(state == :legal, do: [], else: Map.get(audit_state, :illegal_words, []))
    }
  end

  defp doc_moderation_attrs(state, audit_state) do
    reason = Map.get(audit_state, :illegal_reason)

    %{
      moderation_state: state,
      illegal_reason: if(state == :legal, do: nil, else: reason |> List.wrap() |> List.first()),
      illegal_words: if(state == :legal, do: [], else: Map.get(audit_state, :illegal_words, []))
    }
  end

  defp update_author_moderation(article, state, audit_state) do
    article = Repo.preload(article, author: :user)
    user = article.author.user
    changed = Map.get(audit_state, :illegal_articles, [])

    illegal_articles =
      case state do
        :legal -> user.meta.illegal_articles -- changed
        _ -> Enum.uniq(user.meta.illegal_articles ++ changed)
      end

    case ORM.update_meta(user, %{
           has_illegal_articles: illegal_articles != [],
           illegal_articles: illegal_articles
         }) do
      {:ok, _user} ->
        FrontDesk.revalidate().user(user.login)
        {:ok, :pass}

      {:error, _reason} = error ->
        error
    end
  end

  defp update_public_visibility(article_id, state) do
    ArticlePublic
    |> where([public], public.article_id == ^article_id)
    |> Repo.update_all(set: [visible: state == :legal, updated_at: DateTime.utc_now(:second)])

    ArticleBinding
    |> where([binding], binding.article_id == ^article_id)
    |> Repo.update_all(set: [visible: state == :legal, updated_at: DateTime.utc_now(:second)])

    {:ok, :pass}
  end

  defp update_doc_visibility(article_id, branch_id, state) do
    DocPublic
    |> where([public], public.article_id == ^article_id and public.branch_id == ^branch_id)
    |> Repo.update_all(set: [visible: state == :legal, updated_at: DateTime.utc_now(:second)])

    {:ok, :pass}
  end

  defp rebuild_tag_stats(article_id) do
    CommunityTag
    |> join(:inner, [tag], assignment in ArticleBindingTag, on: assignment.tag_id == tag.id)
    |> join(:inner, [_tag, assignment], binding in ArticleBinding,
      on: binding.id == assignment.article_binding_id
    )
    |> where([_tag, _assignment, binding], binding.article_id == ^article_id)
    |> Repo.all()
    |> Enum.reduce_while({:ok, :pass}, fn tag, {:ok, _} ->
      case TagStats.rebuild(tag) do
        {:ok, _stat} -> {:cont, {:ok, :pass}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end

  defp sync_stable_search(article, :legal) do
    _ = Indexer.enqueue_upsert(article)
    {:ok, :pass}
  end

  defp sync_stable_search(article, _state) do
    _ = Indexer.enqueue_delete(article)
    {:ok, :pass}
  end

  defp invalidate_public_cache(%Article{} = article, opts) do
    with {:ok, identity} <- moderation_identity(article, opts) do
      invalidate_public_cache(article, opts, identity)
    end
  end

  defp invalidate_public_cache(%Article{} = article, opts, {identity_type, identity_ref}) do
    operation_id = Keyword.get(opts, :operation_id, identity_ref)

    {:ok, bindings} = CMS.Articles.Bindings.all(article)

    bindings
    |> Enum.reduce_while({:ok, :pass}, fn binding, {:ok, _} ->
      community = binding.community

      case CMS.Outbox.send(%{
             event: "article.visibility_changed",
             worker: CMS.Outbox.Workers.Article.Cleanup,
             resource_type: "article",
             resource_id: article.id,
             identity: {identity_type, identity_ref},
             effect_key:
               "article-binding:#{binding.id}:#{article.moderation_state}:#{article.updated_at}",
             data: %{
               operation_id: operation_id,
               community: community.slug,
               community_id: community.id,
               thread: article.thread,
               inner_id: binding_inner_id(article.id, community.id),
               article_id: article.id
             }
           }) do
        {:ok, _event} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp moderation_identity(%Article{} = article, opts) do
    case Keyword.get(opts, :command_id) do
      command_id when is_binary(command_id) ->
        case Ecto.UUID.cast(command_id) do
          {:ok, command_id} -> {:ok, {:command, command_id}}
          :error -> workflow_moderation_identity(article, opts)
        end

      _ ->
        workflow_moderation_identity(article, opts)
    end
  end

  defp workflow_moderation_identity(article, opts) do
    case Keyword.get(opts, :workflow_ref) do
      workflow_ref when is_binary(workflow_ref) and workflow_ref != "" ->
        {:ok, {:workflow, workflow_ref}}

      _ ->
        {:ok, {:workflow, "article-moderation:#{article.id}:#{article.moderation_state}"}}
    end
  end

  defp binding_inner_id(article_id, community_id) do
    case Repo.get_by(ArticleBinding, article_id: article_id, community_id: community_id) do
      %ArticleBinding{inner_id: inner_id} -> inner_id
      _ -> nil
    end
  end
end
