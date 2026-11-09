defmodule GroupherServer.CMS.Comments.Query.Mentions do
  @moduledoc """
  Confirms public Comment identities together with their readable parent Article.

      Mention references -> Comment Gate -> parent Article Gate -> Comment bindings
  """
  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Query.Mentions, as: Articles
  alias CMS.FrontDesk
  alias CMS.Tickets.Query.Mentions, as: TicketMentions
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Model.Comment

  @doc "Loads existing Comments and their stable parent Articles in one trusted batch."
  def existing(ids) when is_list(ids) do
    ids =
      ids
      |> Enum.map(&cast_id/1)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    case ids do
      [] ->
        %{}

      _ ->
        from(comment in Comment,
          join: article in CMS.Model.Article,
          on: article.id == comment.article_id and article.thread == comment.thread,
          where: comment.id in ^ids,
          select: {comment, article}
        )
        |> Repo.all()
        |> Map.new(fn {comment, article} ->
          {comment.id, %{comment: comment, article: article, thread: comment.thread}}
        end)
    end
  end

  @doc "Loads public Comments from structured Comment paths in one batch."
  def paths(paths) when is_list(paths) do
    locators =
      Enum.flat_map(paths, fn
        %{
          article: %{community: community, thread: thread, inner_id: article_id},
          inner_id: comment_id
        } ->
          [{:comment_path, community, thread, article_id, comment_id}]

        _ ->
          []
      end)

    candidates = Enum.map(locators, &%{type: :comment, value: &1})
    found = load_path_comments(candidates)
    {:ok, Enum.flat_map(locators, &List.wrap(Map.get(found, &1)))}
  end

  def load(candidates) do
    ids =
      candidates
      |> Enum.filter(&(&1.type == :comment))
      |> Enum.map(&cast_id(&1.value))
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    readable_pairs = load_comment_pairs(ids)
    comments = Enum.map(readable_pairs, &elem(&1, 0))

    comments_by_id = Map.new(comments, &{&1.id, &1})

    comment_pairs =
      readable_pairs
      |> Enum.map(fn {comment, community_id} ->
        {comment.id, community_id}
      end)
      |> Enum.uniq()

    articles_by_thread =
      comments
      |> comment_article_ids_by_thread()
      |> Map.new(fn {thread, _article_ids} ->
        pairs =
          comment_pairs
          |> Enum.flat_map(fn {comment_id, community_id} ->
            case comments_by_id[comment_id] do
              %Comment{thread: ^thread, article_id: article_id} ->
                [{article_id, community_id, nil}]

              _ ->
                []
            end
          end)
          |> Enum.uniq()

        {thread,
         if(thread == :ticket,
           do: TicketMentions.by_identity_pairs(pairs),
           else: Articles.by_identity_pairs(thread, pairs)
         )}
      end)

    id_comments =
      Enum.reduce(comment_pairs, %{}, fn {comment_id, community_id}, acc ->
        with %Comment{} = comment <- comments_by_id[comment_id],
             {:ok, thread} <- FrontDesk.thread_of(comment),
             {:ok, info} <- match(thread),
             article_id when not is_nil(article_id) <- Map.get(comment, info.foreign_key),
             articles <- Map.get(articles_by_thread, thread, %{}),
             article when not is_nil(article) <-
               Map.get(
                 articles,
                 {article_id, community_id, nil}
               ) do
          value = %{
            comment: comment,
            article: article,
            thread: thread
          }

          Map.put_new(acc, {comment.id, :stable}, value)
        else
          _ -> acc
        end
      end)

    Map.merge(id_comments, load_path_comments(candidates))
  end

  defp load_comment_pairs([]), do: []

  defp load_comment_pairs(ids) do
    Comment
    |> CMS.Gate.scope(nil, :list, CommentContext.all_public())
    |> case do
      %Ecto.Query{} = query ->
        query
        |> where([comment], comment.id in ^ids and as(:gate_comment_lifecycle).state == :visible)
        |> order_by([comment, gate_comment_binding: binding], [comment.id, binding.community_id])
        |> select([comment, gate_comment_binding: binding], {comment, binding.community_id})
        |> Repo.all()

      {:error, _reason} ->
        []
    end
  end

  defp load_path_comments(candidates) do
    locators =
      candidates
      |> Enum.filter(&(&1.type == :comment))
      |> Enum.map(& &1.value)
      |> Enum.filter(&match?({:comment_path, _, _, _, _}, &1))
      |> Enum.uniq()

    case locators do
      [] ->
        %{}

      _ ->
        filter =
          Enum.reduce(locators, dynamic(false), fn
            {:comment_path, slug, thread, article_inner, comment_inner}, condition ->
              dynamic(
                [comment, gate_comment_binding: binding, gate_community: community],
                ^condition or
                  (community.slug == ^slug and comment.thread == ^thread and
                     binding.inner_id == ^article_inner and comment.inner_id == ^comment_inner)
              )
          end)

        matches_query =
          Comment
          |> CMS.Gate.scope(nil, :list, CommentContext.all_public())
          |> case do
            %Ecto.Query{} = query ->
              from(
                [comment, gate_comment_binding: binding, gate_community: community] in query,
                where: ^filter,
                where: as(:gate_comment_lifecycle).state == :visible,
                select: {comment, community.slug, binding.inner_id}
              )

            {:error, _reason} ->
              nil
          end

        matches = if matches_query, do: Repo.all(matches_query), else: []

        parents =
          matches
          |> Enum.group_by(fn {comment, _, _} -> comment.thread end, fn
            {_comment, slug, inner_id} -> {:article_path, slug, inner_id}
          end)
          |> Map.new(fn {thread, parent_locators} ->
            {thread,
             if(thread == :ticket,
               do: TicketMentions.articles(Enum.uniq(parent_locators)),
               else: Articles.articles(thread, Enum.uniq(parent_locators))
             )}
          end)

        Enum.reduce(matches, %{}, fn {comment, slug, article_inner}, acc ->
          key = {:comment_path, slug, comment.thread, article_inner, comment.inner_id}
          article = get_in(parents, [comment.thread, {:article_path, slug, article_inner}])

          if article do
            Map.put(acc, key, %{comment: comment, article: article, thread: comment.thread})
          else
            acc
          end
        end)
    end
  end

  defp comment_article_ids_by_thread(comments) do
    Enum.reduce(comments, %{}, fn comment, acc ->
      with {:ok, thread} <- FrontDesk.thread_of(comment),
           {:ok, info} <- match(thread),
           article_id when not is_nil(article_id) <- Map.get(comment, info.foreign_key) do
        Map.update(acc, thread, [article_id], &[article_id | &1])
      else
        _ -> acc
      end
    end)
  end

  defp cast_id(value) do
    case Ecto.Type.cast(:id, value) do
      {:ok, id} -> id
      :error -> nil
    end
  end
end
