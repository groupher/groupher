defmodule GroupherServer.CMS.ArtimentMentions.Parser do
  @moduledoc false

  import GroupherServer.CMS.Artiment.Matcher
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.{Accounts, CMS}
  alias CMS.{Artiment.Threads, FrontDesk}
  alias CMS.Model.Comment

  @site_host get_config(:general, :site_host)
  @article_threads get_config(:article, :threads)
  @valid_article_prefix Enum.map(@article_threads, &"#{@site_host}/#{&1}/")
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
          optional(:artiment) => struct()
        }

  @spec parse(list()) :: [parsed_mention()]
  def parse(ast) when is_list(ast) do
    ast
    |> Enum.with_index()
    |> Enum.flat_map(fn {node, index} ->
      block_id = node_block_id(node)
      collect_mentions_from_node(node, block_id, [index])
    end)
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
         {:ok, mentioned} <- load_internal_mention(type, inline_mention_value(node)) do
      %{
        mentioned_scope: :internal,
        mentioned_type: mentioned.type,
        mentioned_id: mentioned.id,
        mentioned_url: mentioned.url,
        mention_case: :inline_mention,
        artiment: mentioned.artiment,
        occurrence: %{
          mention_case: :inline_mention,
          block_id: block_id,
          path: path,
          display: inline_mention_display(node),
          normalized_from: "inline_mention"
        }
      }
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

  defp inline_mention_type(_), do: {:error, :invalid_mention_type}

  defp inline_mention_value(%{"target_id" => id}), do: id
  defp inline_mention_value(%{"mentioned_id" => id}), do: id

  defp inline_mention_value(%{"value" => value}) when is_binary(value) do
    case String.split(value, ":", parts: 2) do
      [_type, id] -> id
      [login] -> login
    end
  end

  defp inline_mention_value(_), do: nil

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
    |> normalize_url()
    |> do_parse_link_mention(url, block_id, path)
    |> List.wrap()
    |> Enum.reject(&is_nil/1)
  end

  defp do_parse_link_mention({:ok, %{scope: :internal} = mentioned}, raw_url, block_id, path) do
    %{
      mentioned_scope: :internal,
      mentioned_type: mentioned.type,
      mentioned_id: mentioned.id,
      mentioned_url: mentioned.url,
      mention_case: :inline_mention,
      artiment: mentioned.artiment,
      occurrence: %{
        mention_case: :inline_mention,
        block_id: block_id,
        path: path,
        raw_url: raw_url,
        display: Map.get(mentioned.snapshot, :title, raw_url),
        normalized_from: "link"
      }
    }
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

  defp normalize_url(url) do
    case site_article_link?(url) do
      true -> load_internal_mention_from_url(url)
      false -> {:ok, %{scope: :external, url: url, hash: hash_url(url)}}
    end
  end

  defp load_internal_mention_from_url(url) do
    case link_for_comment?(url) do
      true -> load_comment_from_url(url)
      false -> load_article_from_url(url)
    end
  end

  defp load_comment_from_url(url) do
    %{query: query} = URI.parse(url)

    try do
      comment_id = URI.decode_query(query || "") |> Map.get("comment_id")

      with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
           {:ok, article} <- FrontDesk.article_of(comment),
           {:ok, thread} <- FrontDesk.thread_of(article) do
        {:ok,
         %{
           scope: :internal,
           type: :comment,
           id: comment.id,
           url: "#{article_url(thread, article.id)}?comment_id=#{comment.id}",
           snapshot: %{title: article.title},
           artiment: comment
         }}
      end
    rescue
      _ -> {:error, :invalid_comment_link}
    end
  end

  defp load_article_from_url(url) do
    %{path: path} = URI.parse(url)
    path_list = String.split(path || "", "/")
    article_id = Enum.at(path_list, 2)

    with {:ok, thread} <- parse_thread_slug(Enum.at(path_list, 1)),
         {:ok, info} <- match(thread),
         {:ok, article} <- FrontDesk.get(info.model, article_id) do
      {:ok,
       %{
         scope: :internal,
         type: thread,
         id: article.id,
         url: article_url(thread, article.id),
         snapshot: %{title: article.title},
         artiment: article
       }}
    end
  end

  defp load_internal_mention(:user, value) when is_binary(value) do
    with {:ok, user} <- Accounts.FrontDesk.user(value, fill_meta: false) do
      {:ok, %{type: :user, id: user.id, url: "#{@site_host}/u/#{user.login}", artiment: user}}
    end
  end

  defp load_internal_mention(:user, value) when is_integer(value) do
    with {:ok, user} <- Accounts.FrontDesk.user(value, fill_meta: false) do
      {:ok, %{type: :user, id: user.id, url: "#{@site_host}/u/#{user.login}", artiment: user}}
    end
  end

  defp load_internal_mention(:comment, value),
    do: load_comment_from_url("#{@site_host}/post/0?comment_id=#{value}")

  defp load_internal_mention(type, value) when type in @article_threads do
    with {:ok, info} <- match(type),
         {:ok, article} <- FrontDesk.get(info.model, value) do
      {:ok, %{type: type, id: article.id, url: article_url(type, article.id), artiment: article}}
    end
  end

  defp load_internal_mention(_, _), do: {:error, :invalid_internal_mention}

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
    type =
      type
      |> String.downcase()
      |> String.to_atom()

    cond do
      type == :user -> {:ok, :user}
      type == :comment -> {:ok, :comment}
      type in Threads.article_enums() -> {:ok, type}
      true -> {:error, :invalid_mention_type}
    end
  end

  defp parse_thread_slug(slug) when is_binary(slug) do
    normalized = String.downcase(slug)

    case Enum.find(Threads.article_enums(), fn thread -> Atom.to_string(thread) == normalized end) do
      nil -> {:error, :invalid_thread}
      thread -> {:ok, thread}
    end
  end

  defp parse_thread_slug(_), do: {:error, :invalid_thread}

  defp site_article_link?(url),
    do: Enum.any?(@valid_article_prefix, &String.starts_with?(url, &1))

  defp link_for_comment?(url) do
    with %{query: query} <- URI.parse(url) do
      not is_nil(query) and String.starts_with?(query, "comment_id=")
    end
  end

  defp article_url(thread, id), do: "#{@site_host}/#{thread}/#{id}"

  defp hash_url(url) do
    :sha256
    |> :crypto.hash(url)
    |> Base.encode16(case: :lower)
  end
end
