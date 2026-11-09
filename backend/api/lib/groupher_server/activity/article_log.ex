defmodule GroupherServer.Activity.ArticleLog do
  @moduledoc """
  Reads an Article's permission-aware public ArticleLog surface.

      Article read scope -> contract-visible action subset -> safe projection
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Activity, CMS, Repo}

  alias Activity.Artiment
  alias Activity.ErrorCat, as: ActivityErrorCat

  alias CMS.Model.{Article, ArticleDraft, Community, DocDraft}
  alias Helper.ORM
  alias Helper.ORM.Pagi.{Order}
  alias GroupherServer.{Pagi}
  alias Pagi.Params

  @doc """
  Lists the permission-filtered Activity surface for one Article or Doc branch.

  ## Examples

      Activity.ArticleLog.list(article, actor, %{page: 1})
  """
  @spec list(struct(), struct() | nil, Params.t() | nil) :: {:ok, map()} | {:error, term()}
  def list(article, actor, pagi) do
    with {:ok, canonical} <- authorize_read(article, actor),
         {:ok, handler} <- Artiment.handler(canonical) do
      actions = handler.surface_actions(:article_log)
      article_id = canonical.id
      community = request_community(article) || unique_binding_community(canonical)

      query =
        handler.schema()
        |> where([log], field(log, ^handler.stream_field()) == ^article_id)
        |> where([log], log.action in ^actions)
        |> maybe_branch(article)
        |> maybe_community(community)

      with {:ok, paged} <-
             ORM.pagi(
               query,
               pagi,
               for: handler.schema(),
               surface: "activity.article",
               query_fingerprint:
                 :crypto.hash(
                   :sha256,
                   :erlang.term_to_binary(
                     {canonical.id, canonical.thread, Map.get(article, :branch_id),
                      Map.get(article, :stage, :public)}
                   )
                 )
                 |> Base.encode16(),
               order: %Order{
                 fields: [:occurred_at, :record_sequence],
                 directions: [:desc, :desc],
                 cursor_fields: [:occurred_at, :record_sequence]
               }
             ) do
        with {:ok, entries} <- project_entries(handler, paged.entries, community) do
          {:ok, Map.put(paged, :entries, entries)}
        end
      end
    end
  end

  defp project_entries(handler, entries, community) do
    projected =
      Enum.reduce_while(entries, {:ok, []}, fn log, {:ok, acc} ->
        case handler.project(log, :article_log) do
          {:ok, event} -> {:cont, {:ok, [{log, event} | acc]}}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
      |> case do
        {:ok, items} -> {:ok, Enum.reverse(items)}
        {:error, _reason} = error -> error
      end

    with {:ok, projected} <- projected,
         ticket_refs <-
           projected
           |> Enum.filter(fn {log, _event} ->
             log.action in [:ticket_created, :ticket_linked] and ticket_target?(log.target_type)
           end)
           |> Enum.map(fn {log, _event} -> log.target_ref end)
           |> Enum.uniq(),
         {:ok, public_tickets} <- public_ticket_targets(community, ticket_refs) do
      entries =
        Enum.map(projected, fn {log, event} ->
          if log.action in [:ticket_created, :ticket_linked] and ticket_target?(log.target_type) do
            Map.put(event, :target, Map.get(public_tickets, log.target_ref))
          else
            event
          end
        end)

      {:ok, entries}
    end
  end

  defp request_community(%{community: %Community{} = community}), do: community
  defp request_community(%{community: %{id: id, slug: slug}}), do: %Community{id: id, slug: slug}
  defp request_community(%{community: slug}) when is_binary(slug), do: load_community(slug)
  defp request_community(%{community_slug: slug}) when is_binary(slug), do: load_community(slug)
  defp request_community(_article), do: nil

  defp unique_binding_community(article) do
    case CMS.articles_bindings_all(article) do
      {:ok, [%{community: %Community{} = community}]} -> community
      _ -> nil
    end
  end

  defp load_community(slug) do
    case CMS.front_desk_community(slug) do
      {:ok, %Community{} = community} -> community
      _ -> nil
    end
  end

  defp ticket_target?(type), do: type in [:ticket, "ticket"]

  defp maybe_community(query, community) do
    case community do
      %Community{id: community_id} -> where(query, [log], log.community_id == ^community_id)
      nil -> query
    end
  end

  defp public_ticket_targets(_community, []), do: {:ok, %{}}
  defp public_ticket_targets(nil, _ticket_refs), do: {:error, ActivityErrorCat.invalid_source()}

  defp public_ticket_targets(%Community{} = community, ticket_refs) do
    ticket_refs
    |> Enum.chunk_every(20)
    |> Enum.reduce_while({:ok, %{}}, fn refs, {:ok, targets} ->
      case CMS.tickets_public_activity_targets(community, refs) do
        {:ok, batch} -> {:cont, {:ok, Map.merge(targets, batch)}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end

  defp authorize_read(%ArticleDraft{article_id: article_id}, actor) do
    case Repo.get(Article, article_id) do
      %Article{thread: thread} ->
        authorize_scoped(
          article_id,
          actor,
          :read_draft,
          GroupherServer.CMS.gate_context_scope_article_draft(thread, :owner_management)
        )

      nil ->
        {:error, GroupherServer.CMS.articles_error_cat_not_exist("Article")}
    end
  end

  defp authorize_read(%DocDraft{article_id: article_id, branch_id: branch_id}, actor) do
    authorize_scoped(
      article_id,
      actor,
      :read_draft,
      GroupherServer.CMS.gate_context_scope_doc_draft(branch_id, :owner_management)
    )
  end

  defp authorize_read(%Article{id: article_id, thread: thread}, actor) when thread != :doc do
    authorize_scoped(
      article_id,
      actor,
      :read,
      GroupherServer.CMS.gate_context_scope_article_public(thread)
    )
  end

  defp authorize_read(article, actor) do
    with thread when is_atom(thread) <- Map.get(article, :thread),
         article_id when is_binary(article_id) <-
           Map.get(article, :article_id) || Map.get(article, :id),
         {:ok, action, context} <- scope_context(article, thread) do
      authorize_scoped(article_id, actor, action, context)
    else
      {:error, _reason} = error -> error
      _ -> {:error, ActivityErrorCat.custom("invalid Activity Article scope")}
    end
  end

  defp authorize_scoped(article_id, actor, action, context) do
    with %Ecto.Query{} = query <- GroupherServer.CMS.gate_scope(Article, actor, action, context),
         %Article{} = canonical <-
           query |> where([candidate], candidate.id == ^article_id) |> Repo.one() do
      {:ok, canonical}
    else
      nil -> {:error, GroupherServer.CMS.articles_error_cat_not_exist("Article")}
      {:error, _reason} = error -> error
    end
  end

  defp scope_context(%{stage: :draft, branch_id: branch_id}, :doc)
       when is_integer(branch_id) do
    {:ok, :read_draft,
     GroupherServer.CMS.gate_context_scope_doc_draft(branch_id, :owner_management)}
  end

  defp scope_context(%{stage: :public, branch_id: branch_id}, :doc)
       when is_integer(branch_id) do
    {:ok, :read, GroupherServer.CMS.gate_context_scope_doc_public_branch(branch_id)}
  end

  defp scope_context(%{stage: :draft}, thread) do
    {:ok, :read_draft,
     GroupherServer.CMS.gate_context_scope_article_draft(thread, :owner_management)}
  end

  defp scope_context(%{stage: :public}, thread) do
    {:ok, :read, GroupherServer.CMS.gate_context_scope_article_public(thread)}
  end

  defp scope_context(_article, _thread) do
    {:error, ActivityErrorCat.custom("invalid Activity Article scope")}
  end

  defp maybe_branch(query, %{branch_id: branch_id}) when not is_nil(branch_id) do
    where(query, [log], log.branch_id == ^branch_id)
  end

  defp maybe_branch(query, _article), do: query
end
