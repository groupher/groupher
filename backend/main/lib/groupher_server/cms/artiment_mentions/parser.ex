defmodule GroupherServer.CMS.ArtimentMentions.Parser do
  @moduledoc """
  Extracts mention candidates from the canonical Plate AST.

  The parser walks blocks and inline children, preserves the block/path location
  for each occurrence, and normalizes both editor mention nodes and pasted links
  into the same downstream shape.

      Plate AST
          |
          v
      inline mention nodes + text/link URLs
          |
          v
      internal candidates  ----> resolved article/comment/user structs
      external URLs        ----> url + hash facts

  This module only parses and resolves mention targets. It does not delete,
  insert, notify, or update mailbox state; those side effects belong to the
  mention sync and messaging layers.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.{Artiment.Threads, ArtimentMentions.Config, ErrorCat, FrontDesk}
  alias GroupherServer.Repo

  @threads Config.threads()
  @valid_article_prefix Config.valid_article_prefixes()
  @href_regex ~r/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
  @url_regex ~r/https?:\/\/[^\s<>"']+/u

  @type parsed_mention :: %{
          required(:mentioned_scope) => :internal | :external,
          required(:mentioned_type) => atom(),
          optional(:mentioned_id) => integer(),
          optional(:mentioned_url) => String.t(),
          optional(:mentioned_url_hash) => String.t(),
          required(:mention_case) => :inline_mention | :link,
          required(:occurrence) => map(),
          optional(:artiment) => struct(),
          optional(:parent_article) => struct()
        }

  @doc """
  Parses the canonical Plate AST and batch-resolves all internal Mention targets.

  Comment results retain their already-loaded parent Article so downstream
  snapshot construction stays query-free.
  """
  @spec parse(list()) :: [parsed_mention()]
  def parse(ast) when is_list(ast) do
    ast
    |> Enum.with_index()
    |> Enum.flat_map(fn {node, index} ->
      block_id = node_block_id(node)
      collect_mentions_from_node(node, block_id, [index])
    end)
    |> resolve_internal_mentions()
    |> Enum.uniq()
  end

  def parse(_), do: []

  defp collect_mentions_from_node(%{"type" => "mention"} = node, block_id, path) do
    node
    |> parse_inline_mention(block_id, path)
    |> List.wrap()
    |> Enum.reject(&is_nil/1)
    |> Kernel.++(collect_children_mentions(node, block_id, path))
  end

  defp collect_mentions_from_node(%{"text" => text} = node, block_id, path)
       when is_binary(text) do
    text_mentions =
      text
      |> extract_links_from_text()
      |> Enum.flat_map(&parse_link_mention(&1, block_id, path))

    text_mentions ++ collect_children_mentions(node, block_id, path)
  end

  defp collect_mentions_from_node(node, block_id, path) when is_map(node) do
    collect_children_mentions(node, block_id, path)
  end

  defp collect_mentions_from_node(_, _, _), do: []

  defp collect_children_mentions(%{"children" => children}, block_id, path)
       when is_list(children) do
    children
    |> Enum.with_index()
    |> Enum.flat_map(fn {node, index} ->
      collect_mentions_from_node(node, block_id, path ++ [index])
    end)
  end

  defp collect_children_mentions(_, _, _), do: []

  defp parse_inline_mention(node, block_id, path) do
    with {:ok, type} <- inline_mention_type(node),
         value when not is_nil(value) <- inline_mention_value(type, node) do
      internal_mention_candidate(type, value, %{
        mention_case: :inline_mention,
        block_id: block_id,
        path: path,
        display: inline_mention_display(node),
        normalized_from: "inline_mention"
      })
    else
      _ -> nil
    end
  end

  defp inline_mention_type(%{"target_type" => type}) when is_binary(type),
    do: parse_mention_type(type)

  defp inline_mention_type(%{"mentioned_type" => type}) when is_binary(type),
    do: parse_mention_type(type)

  defp inline_mention_type(%{"value" => value}) when is_binary(value) do
    case String.split(value, ":", parts: 2) do
      [type, _] -> parse_mention_type(type)
      [_login] -> {:ok, :user}
    end
  end

  defp inline_mention_type(_), do: {:error, ErrorCat.invalid_mention_type()}

  defp inline_mention_value(:user, %{"value" => value}) when is_binary(value) do
    case String.split(value, ":", parts: 2) do
      [_type, login] -> login
      [login] -> login
    end
  end

  defp inline_mention_value(:user, _), do: nil

  defp inline_mention_value(_type, %{"target_id" => id}), do: id
  defp inline_mention_value(_type, %{"mentioned_id" => id}), do: id

  defp inline_mention_value(_type, %{"value" => value}) when is_binary(value) do
    case String.split(value, ":", parts: 2) do
      [_type, id] -> id
      [login] -> login
    end
  end

  defp inline_mention_value(_, _), do: nil

  defp inline_mention_display(%{"children" => children}) when is_list(children) do
    children
    |> Enum.map(&extract_text/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.join(" ")
  end

  defp inline_mention_display(%{"value" => value}) when is_binary(value), do: value
  defp inline_mention_display(_), do: ""

  defp extract_text(%{"text" => text}) when is_binary(text), do: text

  defp extract_text(%{"children" => children}) when is_list(children),
    do: Enum.map_join(children, " ", &extract_text/1)

  defp extract_text(_), do: ""

  defp parse_link_mention(url, block_id, path) do
    url
    |> classify_url()
    |> do_parse_link_mention(url, block_id, path)
    |> List.wrap()
    |> Enum.reject(&is_nil/1)
  end

  defp do_parse_link_mention(
         {:ok, %{scope: :internal, type: type, value: value}},
         raw_url,
         block_id,
         path
       ) do
    internal_mention_candidate(type, value, %{
      mention_case: :inline_mention,
      block_id: block_id,
      path: path,
      raw_url: raw_url,
      display: raw_url,
      normalized_from: "link"
    })
  end

  defp do_parse_link_mention(
         {:ok, %{scope: :external, url: url, hash: hash}},
         raw_url,
         block_id,
         path
       ) do
    %{
      mentioned_scope: :external,
      mentioned_type: :url,
      mentioned_url: url,
      mentioned_url_hash: hash,
      mention_case: :link,
      occurrence: %{
        mention_case: :link,
        block_id: block_id,
        path: path,
        raw_url: raw_url,
        normalized_from: "link"
      }
    }
  end

  defp do_parse_link_mention(_, _, _, _), do: nil

  defp classify_url(url) do
    case site_article_link?(url) do
      true -> internal_mention_from_url(url)
      false -> {:ok, %{scope: :external, url: url, hash: hash_url(url)}}
    end
  end

  defp internal_mention_from_url(url) do
    case link_for_comment?(url) do
      true -> comment_mention_from_url(url)
      false -> article_mention_from_url(url)
    end
  end

  defp comment_mention_from_url(url) do
    %{query: query} = URI.parse(url)

    try do
      comment_id = URI.decode_query(query || "") |> Map.get("comment_id")

      case comment_id do
        nil -> {:error, ErrorCat.invalid_comment_link()}
        comment_id -> {:ok, %{scope: :internal, type: :comment, value: comment_id}}
      end
    rescue
      _ -> {:error, ErrorCat.invalid_comment_link()}
    end
  end

  defp article_mention_from_url(url) do
    %{path: path} = URI.parse(url)
    path_list = String.split(path || "", "/")
    article_id = Enum.at(path_list, 2)

    with {:ok, thread} <- parse_thread_slug(Enum.at(path_list, 1)),
         article_id when not is_nil(article_id) <- article_id do
      {:ok, %{scope: :internal, type: thread, value: article_id}}
    end
  end

  defp internal_mention_candidate(type, value, occurrence) do
    %{
      internal_mention_candidate?: true,
      type: type,
      value: value,
      occurrence: occurrence
    }
  end

  defp resolve_internal_mentions(mentions) do
    cache = internal_mention_cache(mentions)

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

  defp internal_mention_cache(mentions) do
    candidates = Enum.filter(mentions, &Map.get(&1, :internal_mention_candidate?))

    %{
      users_by_login: load_users_by_login(candidates),
      articles_by_thread: load_articles_by_thread(candidates),
      comments: load_comments(candidates)
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
    with id when not is_nil(id) <- cast_id(value),
         %{comment: comment, article: article, thread: thread} <- Map.get(cache.comments, id) do
      candidate
      |> resolved_internal_mention(%{
        type: :comment,
        id: comment.id,
        url: "#{article_url(thread, article.id)}?comment_id=#{comment.id}",
        snapshot: %{title: article.title},
        artiment: comment,
        parent_article: article
      })
    else
      _ -> nil
    end
  end

  defp resolve_internal_mention(%{type: type, value: value} = candidate, cache)
       when type in @threads do
    with id when not is_nil(id) <- cast_id(value),
         articles <- Map.get(cache.articles_by_thread, type, %{}),
         article when not is_nil(article) <- Map.get(articles, id) do
      candidate
      |> resolved_internal_mention(%{
        type: type,
        id: article.id,
        url: article_url(type, article.id),
        snapshot: %{title: article.title},
        artiment: article
      })
    else
      _ -> nil
    end
  end

  defp resolve_internal_mention(_, _), do: nil

  defp resolved_internal_mention(candidate, mentioned) do
    occurrence =
      case Map.get(candidate.occurrence, :normalized_from) do
        "link" ->
          Map.put(
            candidate.occurrence,
            :display,
            get_in(mentioned, [:snapshot, :title]) || Map.get(candidate.occurrence, :raw_url, "")
          )

        _ ->
          candidate.occurrence
      end

    %{
      mentioned_scope: :internal,
      mentioned_type: mentioned.type,
      mentioned_id: mentioned.id,
      mentioned_url: mentioned.url,
      mention_case: :inline_mention,
      artiment: mentioned.artiment,
      occurrence: occurrence
    }
    |> maybe_put_parent_article(mentioned)
  end

  defp maybe_put_parent_article(mention, %{parent_article: article}),
    do: Map.put(mention, :parent_article, article)

  defp maybe_put_parent_article(mention, _), do: mention

  defp resolve_user(candidate, %User{} = user) do
    candidate
    |> resolved_internal_mention(%{
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

  defp load_articles_by_thread(candidates) do
    @threads
    |> Map.new(fn thread ->
      ids =
        candidates
        |> Enum.filter(&(&1.type == thread))
        |> Enum.map(&cast_id(&1.value))
        |> Enum.reject(&is_nil/1)
        |> Enum.uniq()

      {thread, load_articles(thread, ids)}
    end)
  end

  defp load_articles(_thread, []), do: %{}

  defp load_articles(thread, ids) do
    case match(thread) do
      {:ok, info} ->
        info.model
        |> where([a], a.id in ^ids)
        |> Repo.all()
        |> Map.new(&{&1.id, &1})

      _ ->
        %{}
    end
  end

  defp load_comments(candidates) do
    ids =
      candidates
      |> Enum.filter(&(&1.type == :comment))
      |> Enum.map(&cast_id(&1.value))
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    comments =
      case ids do
        [] ->
          []

        ids ->
          Comment
          |> where([c], c.id in ^ids)
          |> Repo.all()
      end

    articles_by_thread =
      comments
      |> comment_article_ids_by_thread()
      |> Map.new(fn {thread, ids} -> {thread, load_articles(thread, Enum.uniq(ids))} end)

    comments
    |> Enum.reduce(%{}, fn comment, acc ->
      with {:ok, thread} <- FrontDesk.thread_of(comment),
           {:ok, info} <- match(thread),
           article_id when not is_nil(article_id) <- Map.get(comment, info.foreign_key),
           articles <- Map.get(articles_by_thread, thread, %{}),
           article when not is_nil(article) <- Map.get(articles, article_id) do
        Map.put(acc, comment.id, %{comment: comment, article: article, thread: thread})
      else
        _ -> acc
      end
    end)
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

  defp extract_links_from_text(text) do
    hrefs =
      @href_regex
      |> Regex.scan(text, capture: :all_but_first)
      |> Enum.map(fn captures ->
        Enum.find(captures, fn part -> is_binary(part) and part != "" end)
      end)
      |> Enum.reject(&is_nil/1)

    urls =
      @url_regex
      |> Regex.scan(text)
      |> Enum.map(&List.first/1)
      |> Enum.reject(&is_nil/1)

    Enum.uniq(hrefs ++ urls)
  end

  defp node_block_id(%{"id" => block_id}) when is_binary(block_id), do: block_id
  defp node_block_id(%{"_id" => block_id}) when is_binary(block_id), do: block_id
  defp node_block_id(_), do: "block-unknown"

  defp parse_mention_type(type) do
    case String.downcase(type) do
      "user" ->
        {:ok, :user}

      "comment" ->
        {:ok, :comment}

      normalized ->
        case Enum.find(Threads.article_enums(), &(Atom.to_string(&1) == normalized)) do
          nil -> {:error, ErrorCat.invalid_mention_type()}
          thread -> {:ok, thread}
        end
    end
  end

  defp parse_thread_slug(slug) when is_binary(slug) do
    normalized = String.downcase(slug)

    case Enum.find(Threads.article_enums(), fn thread -> Atom.to_string(thread) == normalized end) do
      nil -> {:error, ErrorCat.invalid_thread()}
      thread -> {:ok, thread}
    end
  end

  defp parse_thread_slug(_), do: {:error, ErrorCat.invalid_thread()}

  defp site_article_link?(url),
    do: Enum.any?(@valid_article_prefix, &String.starts_with?(url, &1))

  defp link_for_comment?(url) do
    with %{query: query} <- URI.parse(url) do
      not is_nil(query) and String.starts_with?(query, "comment_id=")
    end
  end

  defp article_url(thread, id), do: Config.article_url(thread, id)

  defp hash_url(url) do
    :sha256
    |> :crypto.hash(url)
    |> Base.encode16(case: :lower)
  end
end
