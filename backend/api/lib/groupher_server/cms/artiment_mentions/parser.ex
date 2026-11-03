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

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User

  alias CMS.{
    ArtimentMentions.Config,
    ArtimentMentions.PublicUrl,
    ErrorCat,
    FrontDesk
  }

  alias CMS.Model.{
    ArticleBinding,
    Article,
    ArticlePublic,
    ArticleRevision,
    Comment,
    Community,
    DocBranch,
    DocBranchVersion,
    DocPublic
  }

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
  @spec parse(list(), keyword()) :: [parsed_mention()]
  def parse(ast, opts \\ [])

  def parse(ast, opts) when is_list(ast) do
    ast
    |> Enum.with_index()
    |> Enum.flat_map(fn {node, index} ->
      block_id = node_block_id(node)
      collect_mentions_from_node(node, block_id, [index])
    end)
    |> resolve_internal_mentions(Keyword.get(opts, :community_id))
    |> Enum.uniq()
  end

  def parse(_, _opts), do: []

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

  defp inline_mention_type(%{"target_type" => type}) when is_binary(type) do
    parse_mention_type(type)
  end

  defp inline_mention_type(%{"mentioned_type" => type}) when is_binary(type) do
    parse_mention_type(type)
  end

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

  defp extract_text(%{"children" => children}) when is_list(children) do
    Enum.map_join(children, " ", &extract_text/1)
  end

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
    case public_article_link(url) do
      {:ok, mention} ->
        {:ok, mention}

      :external ->
        if site_article_link?(url) do
          internal_mention_from_url(url)
        else
          {:ok, %{scope: :external, url: url, hash: hash_url(url)}}
        end
    end
  end

  # The host is part of the locator's trust boundary. A custom domain has no
  # backend host registry, so it remains an external URL even if its path fits.
  defp public_article_link(url) do
    uri = URI.parse(url)
    site = URI.parse(Config.site_host())

    trusted_host? =
      (uri.scheme == site.scheme and uri.host == site.host and uri.port == site.port) or
        (is_nil(uri.scheme) and is_nil(uri.host) and is_binary(uri.path) and
           String.starts_with?(uri.path, "/"))

    if trusted_host? and is_nil(uri.userinfo) do
      case String.split(uri.path || "", "/", trim: true) do
        [community, thread_slug, inner_id | rest] when rest == [] or length(rest) == 1 ->
          with {:ok, thread} <- parse_thread_slug(thread_slug),
               {inner, ""} when inner > 0 <- Integer.parse(inner_id),
               true <- thread == :doc or rest == [] do
            case uri.fragment do
              nil ->
                {:ok,
                 %{
                   scope: :internal,
                   type: thread,
                   value: {:public, community, inner}
                 }}

              "comment-" <> comment_inner_id ->
                case Integer.parse(comment_inner_id) do
                  {comment_inner, ""} when comment_inner > 0 ->
                    {:ok,
                     %{
                       scope: :internal,
                       type: :comment,
                       value: {:public_comment, community, thread, inner, comment_inner}
                     }}

                  _ ->
                    :external
                end

              _ ->
                :external
            end
          else
            _ -> :external
          end

        _ ->
          :external
      end
    else
      :external
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

  defp internal_mention_cache(mentions, community_id) do
    candidates = Enum.filter(mentions, &Map.get(&1, :internal_mention_candidate?))

    %{
      users_by_login: load_users_by_login(candidates),
      articles_by_thread: load_articles_by_thread(candidates, community_id),
      comments: load_comments(candidates, community_id)
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
         %{comment: comment, article: article} <- Map.get(cache.comments, id),
         url when is_binary(url) <- PublicUrl.comment(article, comment.inner_id) do
      candidate
      |> resolved_internal_mention(%{
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
       when type in @threads do
    with articles <- Map.get(cache.articles_by_thread, type, %{}),
         article when not is_nil(article) <- Map.get(articles, article_locator(value)),
         url when is_binary(url) <- PublicUrl.article(article) do
      candidate
      |> resolved_internal_mention(%{
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

  defp maybe_put_parent_article(mention, %{parent_article: article}) do
    Map.put(mention, :parent_article, article)
  end

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

  defp load_articles_by_thread(candidates, community_id) do
    @threads
    |> Map.new(fn thread ->
      ids =
        candidates
        |> Enum.filter(&(&1.type == thread))
        |> Enum.map(&cast_article_id(&1.value))
        |> Enum.reject(&is_nil/1)
        |> Enum.uniq()

      public_locators =
        candidates
        |> Enum.filter(&(&1.type == thread))
        |> Enum.map(& &1.value)
        |> Enum.filter(&match?({:public, _, _}, &1))
        |> Enum.uniq()

      {thread,
       Map.merge(
         load_articles(thread, ids, community_id),
         load_public_articles(thread, public_locators)
       )}
    end)
  end

  defp load_public_articles(_thread, []), do: %{}

  defp load_public_articles(:ticket, locators) do
    Enum.reduce(locators, %{}, fn {:public, slug, inner_id} = locator, acc ->
      with %Community{} = community <- Repo.get_by(Community, slug: slug),
           {:ok, %{article: article, title: title, binding: binding}} <-
             CMS.Tickets.get_public(community, inner_id) do
        Map.put(acc, locator, %{
          id: article.id,
          article_id: article.id,
          branch_id: nil,
          thread: :ticket,
          community_id: community.id,
          community_slug: community.slug,
          inner_id: binding.inner_id,
          title: title
        })
      else
        _ -> acc
      end
    end)
  end

  defp load_public_articles(thread, locators) do
    pair_filter =
      Enum.reduce(locators, dynamic(false), fn {:public, slug, inner_id}, filter ->
        dynamic(
          [_article, binding, community, ...],
          ^filter or (community.slug == ^slug and binding.inner_id == ^inner_id)
        )
      end)

    query =
      case thread do
        :doc ->
          from(article in Article,
            join: binding in ArticleBinding,
            on: binding.article_id == article.id,
            join: community in Community,
            on: community.id == binding.community_id,
            join: branch in DocBranch,
            on: branch.community_id == community.id and branch.type == :main,
            join: public in DocPublic,
            on: public.article_id == article.id and public.branch_id == branch.id,
            join: version in DocBranchVersion,
            on: version.id == public.branch_version_id,
            join: revision in ArticleRevision,
            on: revision.id == version.revision_id,
            where: article.thread == :doc,
            where: ^pair_filter,
            select: %{
              id: article.id,
              article_id: article.id,
              branch_id: branch.id,
              thread: article.thread,
              community_id: community.id,
              community_slug: community.slug,
              inner_id: binding.inner_id,
              slug: public.slug,
              title: revision.title
            }
          )

        _ ->
          from(article in Article,
            join: binding in ArticleBinding,
            on: binding.article_id == article.id,
            join: community in Community,
            on: community.id == binding.community_id,
            join: public in ArticlePublic,
            on: public.article_id == article.id,
            join: revision in ArticleRevision,
            on: revision.id == public.revision_id,
            where: article.thread == ^thread,
            where: ^pair_filter,
            select: %{
              id: article.id,
              article_id: article.id,
              branch_id: nil,
              thread: article.thread,
              community_id: community.id,
              community_slug: community.slug,
              inner_id: binding.inner_id,
              slug: public.slug,
              title: revision.title
            }
          )
      end

    query
    |> Repo.all()
    |> Map.new(&{{:public, &1.community_slug, &1.inner_id}, &1})
  end

  defp article_locator({:public, _, _} = locator), do: locator
  defp article_locator(value), do: cast_article_id(value)

  defp load_articles(_thread, [], _community_id), do: %{}

  defp load_articles(thread, ids, community_id) do
    query =
      case thread do
        :doc ->
          from(article in Article,
            join: binding in ArticleBinding,
            on: binding.article_id == article.id,
            join: community in Community,
            on: community.id == binding.community_id,
            join: branch in DocBranch,
            on: branch.community_id == binding.community_id and branch.type == :main,
            join: public in DocPublic,
            on: public.article_id == article.id and public.branch_id == branch.id,
            join: version in DocBranchVersion,
            on: version.id == public.branch_version_id,
            join: revision in ArticleRevision,
            on: revision.id == version.revision_id,
            where: article.id in ^ids and article.thread == :doc,
            select: %{
              id: article.id,
              article_id: article.id,
              branch_id: branch.id,
              thread: article.thread,
              community_id: binding.community_id,
              community_slug: community.slug,
              inner_id: binding.inner_id,
              slug: public.slug,
              title: revision.title
            }
          )

        _ ->
          from(article in Article,
            join: binding in ArticleBinding,
            on: binding.article_id == article.id,
            join: community in Community,
            on: community.id == binding.community_id,
            join: public in ArticlePublic,
            on: public.article_id == article.id,
            join: revision in ArticleRevision,
            on: revision.id == public.revision_id,
            where: article.id in ^ids and article.thread == ^thread,
            select: %{
              id: article.id,
              article_id: article.id,
              branch_id: nil,
              thread: article.thread,
              community_id: binding.community_id,
              community_slug: community.slug,
              inner_id: binding.inner_id,
              slug: public.slug,
              title: revision.title
            }
          )
      end

    query
    |> maybe_scope_articles(community_id)
    |> Repo.all()
    |> Map.new(&{&1.id, &1})
  end

  defp maybe_scope_articles(query, nil), do: query

  defp maybe_scope_articles(query, community_id) do
    where(query, [_article, binding, ...], binding.community_id == ^community_id)
  end

  defp load_comments(candidates, community_id) do
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
      |> Map.new(fn {thread, ids} ->
        {thread, load_articles(thread, Enum.uniq(ids), community_id)}
      end)

    id_comments =
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

    Map.merge(id_comments, load_public_comments(candidates))
  end

  defp load_public_comments(candidates) do
    locators =
      candidates
      |> Enum.filter(&(&1.type == :comment))
      |> Enum.map(& &1.value)
      |> Enum.filter(&match?({:public_comment, _, _, _, _}, &1))
      |> Enum.uniq()

    case locators do
      [] ->
        %{}

      _ ->
        filter =
          Enum.reduce(locators, dynamic(false), fn
            {:public_comment, slug, thread, article_inner, comment_inner}, condition ->
              dynamic(
                [comment, binding, community],
                ^condition or
                  (community.slug == ^slug and comment.thread == ^thread and
                     binding.inner_id == ^article_inner and comment.inner_id == ^comment_inner)
              )
          end)

        matches =
          from(comment in Comment,
            join: binding in ArticleBinding,
            on: binding.article_id == comment.article_id,
            join: community in Community,
            on: community.id == binding.community_id,
            where: ^filter,
            select: {comment, community.slug, binding.inner_id}
          )
          |> Repo.all()

        parents =
          matches
          |> Enum.group_by(fn {comment, _, _} -> comment.thread end, fn
            {_comment, slug, inner_id} -> {:public, slug, inner_id}
          end)
          |> Map.new(fn {thread, parent_locators} ->
            {thread, load_public_articles(thread, Enum.uniq(parent_locators))}
          end)

        Enum.reduce(matches, %{}, fn {comment, slug, article_inner}, acc ->
          key = {:public_comment, slug, comment.thread, article_inner, comment.inner_id}
          article = get_in(parents, [comment.thread, {:public, slug, article_inner}])

          if article && (comment.thread != :doc or comment.branch_id == article.branch_id) do
            Map.put(acc, key, %{comment: comment, article: article, thread: comment.thread})
          else
            acc
          end
        end)
    end
  end

  defp comment_locator({:public_comment, _, _, _, _} = locator), do: locator
  defp comment_locator(value), do: cast_id(value)

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

  defp cast_article_id(value) do
    case Ecto.UUID.cast(value) do
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
        case Enum.find(@threads, &(Atom.to_string(&1) == normalized)) do
          nil -> {:error, ErrorCat.invalid_mention_type()}
          thread -> {:ok, thread}
        end
    end
  end

  defp parse_thread_slug(slug) when is_binary(slug) do
    normalized = String.downcase(slug)

    case Enum.find(@threads, fn thread -> Atom.to_string(thread) == normalized end) do
      nil -> {:error, ErrorCat.invalid_thread()}
      thread -> {:ok, thread}
    end
  end

  defp parse_thread_slug(_), do: {:error, ErrorCat.invalid_thread()}

  defp site_article_link?(url) do
    Enum.any?(@valid_article_prefix, &String.starts_with?(url, &1))
  end

  defp link_for_comment?(url) do
    with %{query: query} <- URI.parse(url) do
      not is_nil(query) and String.starts_with?(query, "comment_id=")
    end
  end

  defp hash_url(url) do
    :sha256
    |> :crypto.hash(url)
    |> Base.encode16(case: :lower)
  end
end
