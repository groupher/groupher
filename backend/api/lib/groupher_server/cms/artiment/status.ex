defmodule GroupherServer.CMS.Artiment.Status do
  @moduledoc """
  Reads public resource identity, title, URL and body availability without a Mention edge.
  Graph readers may resolve a batch of the same resource identities.

      FrontDesk -> Artiment.Status -> resource rows + Gate -> status metadata
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    ArticleBinding,
    ArticleDraft,
    ArticleLifecycle,
    ArticlePublic,
    Comment,
    CommentBody,
    CommentLifecycle,
    Community,
    DocBranch,
    DocBranchVersion,
    DocLifecycle,
    DocPublic,
    TicketState
  }

  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Gate.Context.Scope.Ticket, as: TicketContext

  @doc "Reads a single Artiment status by Community and stable or public locator."
  def read(community_slug, %{type: type} = locator) when is_binary(community_slug) do
    with %Community{} = community <- Repo.get_by(Community, slug: community_slug),
         {:ok, ref} <- resolve(community, type, locator),
         {:ok, statuses} <- read_many(community, [ref]),
         %{status: status} = result <- Map.get(statuses, ref.key),
         true <- status != :destroy do
      {:ok, result}
    else
      _ -> {:error, CMS.ErrorCat.artiment_status_not_found()}
    end
  end

  def read(_, _), do: {:error, CMS.ErrorCat.artiment_status_not_found()}

  @doc "Reads resource statuses in a bounded batch; refs carry key, type and stable identity."
  def read_many(%Community{}, []), do: {:ok, %{}}

  def read_many(%Community{} = community, refs) when is_list(refs) do
    comments =
      refs
      |> Enum.filter(&(&1.type == :comment))
      |> Enum.map(& &1.comment_id)
      |> query_ids(Comment, :id)
      |> Map.new(&{&1.id, &1})

    article_ids =
      (Enum.map(refs, &Map.get(&1, :article_id)) ++
         Enum.map(Map.values(comments), & &1.article_id))
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    binding_rows =
      Repo.all(
        from(binding in ArticleBinding,
          join: owner in Community,
          on: owner.id == binding.community_id,
          where: binding.article_id in ^article_ids,
          select: {binding, owner}
        )
      )

    bindings =
      binding_rows
      |> Enum.filter(fn {binding, _owner} -> binding.community_id == community.id end)
      |> Map.new(fn {binding, _owner} -> {binding.article_id, binding} end)

    doc_comment_parent_ids =
      comments
      |> Map.values()
      |> Enum.filter(&(&1.thread == :doc))
      |> MapSet.new(& &1.article_id)

    comment_parents =
      binding_rows
      |> Enum.group_by(fn {binding, _owner} -> binding.article_id end)
      |> Enum.flat_map(fn {article_id, rows} ->
        current =
          Enum.find(rows, fn {binding, _owner} -> binding.community_id == community.id end)

        cond do
          current ->
            [{article_id, current}]

          MapSet.member?(doc_comment_parent_ids, article_id) and length(rows) == 1 ->
            [{article_id, hd(rows)}]

          true ->
            []
        end
      end)
      |> Map.new()

    ordinary_ids =
      refs |> Enum.reject(&(&1.type in [:comment, :doc])) |> Enum.map(& &1.article_id)

    doc_ids = refs |> Enum.filter(&(&1.type == :doc)) |> Enum.map(& &1.article_id)

    doc_ids =
      (doc_ids ++
         (comments
          |> Map.values()
          |> Enum.filter(&(&1.thread == :doc))
          |> Enum.map(& &1.article_id)))
      |> Enum.uniq()

    publics =
      query_ids(ordinary_ids, ArticlePublic, :article_id)
      |> Map.new(&{&1.article_id, &1})

    drafts =
      query_ids(ordinary_ids, ArticleDraft, :article_id)
      |> Map.new(&{&1.article_id, &1})

    doc_publics =
      if doc_ids == [],
        do: [],
        else:
          Repo.all(
            from(public in DocPublic,
              join: branch in DocBranch,
              on: branch.id == public.branch_id and branch.type == :main,
              where: public.article_id in ^doc_ids
            )
          )

    doc_publics = Map.new(doc_publics, &{&1.article_id, &1})

    doc_titles =
      if doc_ids == [],
        do: [],
        else:
          Repo.all(
            from(branch in DocBranch,
              join: version in DocBranchVersion,
              on: version.branch_id == branch.id,
              where: version.article_id in ^doc_ids and branch.type == :main,
              select: {version.article_id, branch.title}
            )
          )

    doc_titles = Map.new(doc_titles)

    article_states =
      query_ids(article_ids, ArticleLifecycle, :article_id)
      |> Map.new(&{&1.article_id, &1.state})

    doc_states =
      if doc_ids == [],
        do: [],
        else:
          Repo.all(
            from(state in DocLifecycle,
              join: branch in DocBranch,
              on: branch.id == state.branch_id and branch.type == :main,
              where: state.article_id in ^doc_ids,
              select: {state.article_id, state.state}
            )
          )

    doc_states = Map.new(doc_states)
    comment_ids = Map.keys(comments)

    comment_states =
      query_ids(comment_ids, CommentLifecycle, :comment_id)
      |> Map.new(&{&1.comment_id, &1.state})

    bodies =
      query_ids(comment_ids, CommentBody, :comment_id)
      |> Map.new(&{&1.comment_id, &1})

    readable = readable_ids(community, refs, comments, comment_parents)

    statuses =
      Map.new(refs, fn ref ->
        {key, status} =
          if ref.type == :comment do
            comment = comments[ref.comment_id]
            parent_id = comment && comment.article_id
            {binding, owner} = Map.get(comment_parents, parent_id, {nil, community})

            url_parent =
              if binding,
                do: %{
                  community_slug: owner.slug,
                  thread: comment.thread,
                  inner_id: binding.inner_id,
                  slug: doc_publics[parent_id] && doc_publics[parent_id].slug
                },
                else: %{
                  community_slug: owner.slug,
                  thread: comment && comment.thread,
                  article_id: parent_id
                }

            fallback_parent = %{
              community_slug: owner.slug,
              thread: comment && comment.thread,
              article_id: parent_id
            }

            url =
              if comment do
                CMS.FrontDesk.comment_url(url_parent, comment.inner_id) ||
                  CMS.FrontDesk.comment_url(fallback_parent, comment.inner_id)
              end

            title =
              if MapSet.member?(readable, ref.key) do
                bodies[ref.comment_id] && bodies[ref.comment_id].digest
              else
                comment && "评论 ##{comment.inner_id}"
              end

            metadata = %{
              type: :comment,
              thread: comment && comment.thread,
              title: title,
              url: url,
              article_id: parent_id,
              article_inner_id: binding && binding.inner_id,
              comment_inner_id: comment && comment.inner_id
            }

            state = comment_states[ref.comment_id]

            {ref.key,
             Map.put(metadata, :status, classify(state, MapSet.member?(readable, ref.key)))}
          else
            binding = bindings[ref.article_id]

            public =
              if ref.type == :doc, do: doc_publics[ref.article_id], else: publics[ref.article_id]

            title =
              if ref.type == :doc,
                do: (public && public.title) || doc_titles[ref.article_id] || "",
                else:
                  (public && public.title) ||
                    (drafts[ref.article_id] && drafts[ref.article_id].title) || ""

            path =
              if binding,
                do: %{
                  community_slug: community.slug,
                  thread: ref.type,
                  inner_id: binding.inner_id,
                  slug: public && public.slug
                },
                else: %{
                  community_slug: community.slug,
                  thread: ref.type,
                  article_id: ref.article_id
                }

            state =
              if ref.type == :doc,
                do: doc_states[ref.article_id],
                else: article_states[ref.article_id]

            fallback_path = %{
              community_slug: community.slug,
              thread: ref.type,
              article_id: ref.article_id
            }

            metadata = %{
              type: ref.type,
              title: title,
              url: CMS.FrontDesk.article_url(path) || CMS.FrontDesk.article_url(fallback_path),
              article_id: ref.article_id,
              article_inner_id: binding && binding.inner_id,
              comment_inner_id: nil
            }

            {ref.key,
             Map.put(metadata, :status, classify(state, MapSet.member?(readable, ref.key)))}
          end

        {key, status}
      end)

    {:ok, statuses}
  end

  defp classify(:destroy, _), do: :destroy
  defp classify(:deleted, _), do: :deleted
  defp classify(_, true), do: :readable
  defp classify(_, false), do: :unavailable

  defp readable_ids(community, refs, comments, comment_parents) do
    refs
    |> Enum.group_by(& &1.type)
    |> Enum.flat_map(fn {type, group} ->
      if type == :comment do
        group
        |> Enum.filter(&Map.has_key?(comments, &1.comment_id))
        |> Enum.group_by(fn ref ->
          comment = comments[ref.comment_id]
          {_binding, owner} = Map.get(comment_parents, comment.article_id, {nil, community})
          {comment.thread, owner.id}
        end)
        |> Enum.flat_map(fn {{thread, owner_id}, items} ->
          ids = Enum.map(items, & &1.comment_id)

          CMS.Gate.scope(
            Comment,
            nil,
            :read,
            CommentContext.mentioned_target(thread, owner_id)
          )
          |> scope_query()
          |> where([comment], comment.id in ^ids)
          |> select([comment], comment.id)
          |> Repo.all()
          |> Enum.map(fn id -> Enum.find(items, &(&1.comment_id == id)).key end)
        end)
      else
        ids = Enum.map(group, & &1.article_id)

        scope =
          case type do
            :doc -> DocContext.public_main()
            :ticket -> TicketContext.public(community)
            _ -> ArticleContext.public(type)
          end

        query =
          if type == :ticket,
            do:
              CMS.Gate.scope(TicketState, nil, :read, scope)
              |> scope_query()
              |> where([ticket_state: state], state.article_id in ^ids)
              |> select([ticket_state: state], state.article_id),
            else:
              CMS.Gate.scope(CMS.Model.Article, nil, :read, scope)
              |> scope_query()
              |> where(
                [article, ...],
                article.id in ^ids and as(:gate_community).id == ^community.id
              )
              |> select([article, ...], article.id)

        Repo.all(query)
        |> Enum.map(fn id -> Enum.find(group, &(&1.article_id == id)).key end)
      end
    end)
    |> MapSet.new()
  end

  defp resolve(community, :comment, locator) do
    with {inner_id, ""} <- Integer.parse(to_string(Map.get(locator, :comment_inner_id))),
         %Comment{id: id} <- resolve_comment(community, locator, inner_id) do
      {:ok, %{key: {:comment, id}, type: :comment, comment_id: id}}
    else
      _ -> {:error, :not_found}
    end
  end

  defp resolve(community, type, locator) do
    with true <- type in Ecto.Enum.values(CMS.Model.Article, :thread),
         {:ok, id} <- article_id(community, locator),
         %CMS.Model.Article{thread: ^type} <- Repo.get(CMS.Model.Article, id) do
      {:ok, %{key: {type, id}, type: type, article_id: id}}
    else
      _ -> {:error, :not_found}
    end
  end

  defp resolve_comment(_community, %{article_id: article_id}, inner_id)
       when is_binary(article_id) do
    case Ecto.UUID.cast(article_id) do
      {:ok, id} -> Repo.get_by(Comment, article_id: id, inner_id: inner_id)
      _ -> nil
    end
  end

  defp resolve_comment(community, %{article_inner_id: article_inner_id}, inner_id) do
    case Integer.parse(to_string(article_inner_id)) do
      {number, ""} ->
        Repo.one(
          from(comment in Comment,
            join: binding in ArticleBinding,
            on: binding.article_id == comment.article_id and binding.thread == comment.thread,
            where:
              binding.community_id == ^community.id and binding.inner_id == ^number and
                comment.inner_id == ^inner_id,
            limit: 1
          )
        )

      _ ->
        nil
    end
  end

  defp resolve_comment(_, _, _), do: nil

  defp article_id(_, %{article_id: id}) when is_binary(id), do: Ecto.UUID.cast(id)

  defp article_id(community, %{type: type, article_inner_id: inner_id}) do
    with {number, ""} <- Integer.parse(to_string(inner_id)),
         %ArticleBinding{article_id: id} <-
           Repo.get_by(ArticleBinding, community_id: community.id, thread: type, inner_id: number) do
      {:ok, id}
    else
      _ -> {:error, :not_found}
    end
  end

  defp article_id(_, _), do: {:error, :not_found}

  defp scope_query({:ok, %Ecto.Query{} = query}), do: query
  defp scope_query(%Ecto.Query{} = query), do: query

  defp query_ids([], _, _), do: []

  defp query_ids(ids, schema, field_name) do
    Repo.all(from(row in schema, where: field(row, ^field_name) in ^ids))
  end
end
