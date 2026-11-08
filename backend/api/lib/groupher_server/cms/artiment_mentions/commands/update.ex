defmodule GroupherServer.CMS.ArtimentMentions.Commands.Update do
  @moduledoc """
  Saves the selected published body's current Mentions in its owning Command transaction.

      selected public body -> Parser -> target query -> Persist -> notification Outbox
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.ArtimentMentions.{
    Config,
    Effects,
    Parser,
    Persist,
    Query
  }

  alias CMS.Articles.Query.Mentions, as: ArticleMentions
  alias CMS.Comments.Query.Mentions, as: CommentMentions
  alias CMS.Tickets.Query.Mentions, as: TicketMentions
  alias CMS.Model.Article
  alias GroupherServer.Accounts.Model.User


  @mention_threads Config.threads()

  @doc "Updates one selected body and its current relationships in the caller transaction."
  def execute(
        source_identity,
        selected_body,
        outbox_identity
      )
      when is_map(source_identity) and is_map(selected_body) and is_tuple(outbox_identity) do
    execute(source_identity, selected_body, outbox_identity, [])
  end

  def execute(_, _, _), do: {:error, :invalid_mention_capture}

  def execute(
        source_identity,
        %{
          published_revision_identity: revision_identity,
          ast: ast,
          community_id: community_id,
          mentioned_at: mentioned_at
        },
        outbox_identity,
        opts
      )
      when is_map(source_identity) and is_binary(revision_identity) and is_list(ast) and
             (is_nil(community_id) or is_integer(community_id)) and
             is_struct(mentioned_at, DateTime) and is_tuple(outbox_identity) and
             is_list(opts) do
    with true <- Repo.in_transaction?(),
         {:ok, :pass} <- validate_options(opts),
         {:ok, written} <- Parser.mentions(ast),
         {:ok, confirmed} <- target_mentions(written, community_id),
         resolved_mentions <-
           Enum.reject(confirmed, &self_reference?(source_identity, &1)),
         {:ok, source} <- Persist.lock_source(source_identity),
         previous_users <- Query.previous_user_state(source.id),
         mentions <- retain_link_urls(written, resolved_mentions),
         {:ok, saved} <-
           Persist.update_graph(source, %{
             mentions: mentions,
             mentioned_at: mentioned_at
           }),
         recipients <- recipients(previous_users, saved.mentions),
         {:ok, dispatch_result} <-
           dispatch(
             saved,
             revision_identity,
             community_id,
             outbox_identity,
             source_identity.type,
             recipients
           ) do
      {:ok, saved |> Map.delete(:mentions) |> Map.put(:dispatch_result, dispatch_result)}
    else
      false -> {:error, :mention_capture_requires_transaction}
      {:error, _reason} = error -> error
    end
  end

  def execute(_, _, _, _), do: {:error, :invalid_mention_capture}

  defp validate_options(opts) do
    if opts == [] do
      {:ok, :pass}
    else
      {:error, :invalid_mention_capture_options}
    end
  end

  defp dispatch(
         saved,
         revision_identity,
         community_id,
         outbox_identity,
         source_type,
         notification_user_ids
       ) do
    recipients = if source_type == :ticket, do: [], else: notification_user_ids

    if recipients == [] do
      {:ok, :no_notifications}
    else
      Effects.enqueue_notifications(
        saved.source_endpoint_id,
        revision_identity,
        outbox_identity,
        community_id,
        recipients
      )
    end
  end

  defp occurrence_key(position) do
    block_id = Map.get(position, :block_id) || "block"
    path = Map.get(position, :path, [])
    "#{block_id}:#{Enum.join(path, ".")}"
  end

  defp retain_link_urls(candidates, mentions) do
    bound_keys = MapSet.new(mentions, &occurrence_key(&1.occurrence))

    remaining =
      Enum.flat_map(candidates, fn
        %{
          internal_mention_candidate?: true,
          occurrence: %{normalized_from: "link", raw_url: url} = occurrence
        }
        when is_binary(url) ->
          if MapSet.member?(bound_keys, occurrence_key(occurrence)) do
            []
          else
            hash = :crypto.hash(:sha256, url) |> Base.encode16(case: :lower)

            [
              %{
                mentioned_scope: :external,
                mentioned_type: :url,
                mentioned_url: url,
                mentioned_url_hash: hash,
                mention_case: :link,
                occurrence: occurrence
              }
            ]
          end

        _ ->
          []
      end)

    mentions ++ remaining
  end

  defp self_reference?(
         %{type: type, article_id: id},
         %{mentioned_type: type, mentioned_id: id}
       )
       when type in [:post, :blog, :changelog, :doc, :ticket] do
    true
  end

  defp self_reference?(
         %{type: :comment, comment_id: id},
         %{mentioned_type: :comment, mentioned_id: id}
       ) do
    true
  end

  defp self_reference?(_, _), do: false

  @doc false
  def target_mentions(written, community_id) when is_list(written) do
    with {:ok, :pass} <- ArticleMentions.validate_types(written),
         public <- resolve_internal_mentions(written, community_id),
         confirmed_keys <- MapSet.new(public, &occurrence_key(&1.occurrence)),
         selected_articles <-
           Enum.filter(written, fn reference ->
             Map.get(reference, :internal_mention_candidate?) == true and
               Map.get(reference, :type) in [:post, :blog, :changelog, :doc] and
               get_in(reference, [:occurrence, :normalized_from]) == "inline_mention" and
               not MapSet.member?(confirmed_keys, occurrence_key(reference.occurrence))
           end),
         {:ok, hidden} <- confirm_selected_articles(selected_articles) do
      by_position = Map.new(public ++ hidden, &{occurrence_key(&1.occurrence), &1})

      {:ok,
       Enum.flat_map(written, fn reference ->
         case Map.get(by_position, occurrence_key(reference.occurrence)) do
           nil -> []
           mention -> [mention]
         end
       end)}
    end
  end

  def target_mentions(_, _), do: {:error, :invalid_mention_ast}

  defp confirm_selected_articles([]), do: {:ok, []}

  defp confirm_selected_articles(references) do
    ids = references |> Enum.map(& &1.value) |> Enum.uniq()

    with {:ok, articles} <- load_selected_articles(ids) do
      by_id = Map.new(articles, &{&1.id, &1})

      {:ok,
       Enum.flat_map(references, fn %{type: type, value: id} = reference ->
         case Map.get(by_id, id) do
           %Article{thread: ^type} ->
             [
               mention_from_target(reference, %{
                 type: type,
                 id: id,
                 url: nil,
                 artiment: %{article_id: id, thread: type}
               })
             ]

           _ ->
             []
         end
       end)}
    end
  end

  defp load_selected_articles(ids) do
    ids
    |> Enum.chunk_every(100)
    |> Enum.reduce_while({:ok, []}, fn chunk, {:ok, rows} ->
      case CMS.FrontDesk.article(chunk, mode: :internal) do
        {:ok, found} -> {:cont, {:ok, found ++ rows}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end

  defp resolve_internal_mentions(mentions, community_id) do
    cache = internal_mention_cache(mentions, community_id)

    mentions
    |> Enum.flat_map(fn
      %{internal_mention_candidate?: true} = candidate ->
        candidate
        |> resolve_internal_mention(cache)
        |> List.wrap()
        |> Enum.reject(&is_nil/1)

      mention ->
        [mention]
    end)
  end

  defp internal_mention_cache(mentions, _source_community_id) do
    candidates = Enum.filter(mentions, &Map.get(&1, :internal_mention_candidate?))
    comments = CommentMentions.load(candidates)
    ticket_candidates = Enum.filter(candidates, &(&1.type == :ticket))

    ticket_locators =
      ticket_candidates
      |> Enum.map(& &1.value)
      |> Enum.filter(&match?({:article_path, _, _}, &1))
      |> Enum.uniq()

    ticket_ids =
      ticket_candidates
      |> Enum.map(&cast_article_id(&1.value))
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    articles_by_thread =
      candidates
      |> ArticleMentions.load()
      |> Map.put(:ticket, TicketMentions.load(ticket_locators, ticket_ids))

    %{
      users_by_login: load_users_by_login(candidates),
      articles_by_thread: articles_by_thread,
      comments: comments
    }
  end

  defp resolve_internal_mention(
         %{type: :user, value: login} = candidate,
         %{users_by_login: users_by_login}
       )
       when is_binary(login) do
    resolve_user(candidate, Map.get(users_by_login, login))
  end

  defp resolve_internal_mention(%{type: :user}, _), do: nil

  defp resolve_internal_mention(%{type: :comment, value: value} = candidate, cache) do
    with id when not is_nil(id) <- comment_locator(value),
         cache_key <- comment_cache_key(value),
         %{comment: comment, article: article} <- Map.get(cache.comments, cache_key),
         url when is_binary(url) <- CMS.FrontDesk.comment_url(article, comment.inner_id) do
      candidate
      |> mention_from_target(%{
        type: :comment,
        id: comment.id,
        url: url,
        snapshot: %{title: article.title},
        artiment: comment,
        parent_article: article
      })
    else
      _ -> nil
    end
  end

  defp resolve_internal_mention(%{type: type, value: value} = candidate, cache)
       when type in @mention_threads do
    with articles <- Map.get(cache.articles_by_thread, type, %{}),
         key <- article_cache_key(value),
         article when not is_nil(article) <- Map.get(articles, key),
         url when is_binary(url) <- CMS.FrontDesk.article_url(article) do
      candidate
      |> mention_from_target(%{
        type: type,
        id: article.id,
        url: url,
        snapshot: %{title: article.title},
        artiment: article
      })
    else
      _ -> nil
    end
  end

  defp resolve_internal_mention(_, _), do: nil

  defp resolve_user(candidate, %User{} = user) do
    candidate
    |> mention_from_target(%{
      type: :user,
      id: user.id,
      url: Config.user_url(user.login),
      artiment: user
    })
  end

  defp resolve_user(_, _), do: nil

  defp load_users_by_login(candidates) do
    logins =
      candidates
      |> Enum.filter(&(&1.type == :user and is_binary(&1.value)))
      |> Enum.map(& &1.value)
      |> Enum.uniq()

    case logins do
      [] ->
        %{}

      logins ->
        User
        |> where([u], u.login in ^logins)
        |> Repo.all()
        |> Map.new(&{&1.login, &1})
    end
  end

  defp article_cache_key({:article_path, _, _} = locator), do: locator
  defp article_cache_key(value), do: {cast_article_id(value), :stable}

  defp comment_cache_key({:comment_path, _, _, _, _} = locator), do: locator
  defp comment_cache_key(value), do: {cast_id(value), :stable}

  defp comment_locator({:comment_path, _, _, _, _} = locator), do: locator
  defp comment_locator(value), do: cast_id(value)

  defp cast_id(value) do
    case Ecto.Type.cast(:id, value) do
      {:ok, id} -> id
      :error -> nil
    end
  end

  defp cast_article_id(value) do
    case Ecto.UUID.cast(value) do
      {:ok, id} -> id
      :error -> nil
    end
  end

  defp mention_from_target(reference, target) do
    occurrence =
      case Map.get(reference.occurrence, :normalized_from) do
        "link" ->
          Map.put(
            reference.occurrence,
            :display,
            get_in(target, [:snapshot, :title]) || Map.get(reference.occurrence, :raw_url, "")
          )

        _ ->
          reference.occurrence
      end

    mention_case =
      if Map.get(reference.occurrence, :normalized_from) == "link",
        do: :link,
        else: :inline_mention

    mention = %{
      mentioned_scope: :internal,
      mentioned_type: target.type,
      mentioned_id: target.id,
      mentioned_url: target.url,
      mention_case: mention_case,
      artiment: target.artiment,
      occurrence: occurrence
    }

    case target do
      %{parent_article: article} -> Map.put(mention, :parent_article, article)
      _ -> mention
    end
  end

  defp recipients(previous, mentions) do
    user_ids =
      mentions
      |> Enum.filter(&(&1.target_type == :user))
      |> Enum.map(& &1.target_user_id)
      |> Enum.uniq()

    pending = Enum.filter(previous.pending, &(&1 in user_ids))
    Enum.uniq((user_ids -- previous.ids) ++ pending)
  end
end
