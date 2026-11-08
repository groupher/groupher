defmodule GroupherServer.CMS.ArtimentMentions.Parser do
  @moduledoc """
  Extracts mentions from canonical structured Plate nodes.

      Plate AST -> structured link/mention nodes -> mention candidates
  """

  alias GroupherServer.CMS.{ArtimentMentions.Config, ErrorCat}

  @threads Config.threads()
  @max_url_bytes 1200
  @valid_article_prefix Config.valid_article_prefixes()

  @doc "Returns mentions written as structured Plate nodes, with AST positions."
  def mentions(ast) when is_list(ast) do
    written = written_references(ast)

    if Enum.any?(written, fn mention ->
         case Map.get(mention, :mentioned_url) do
           url when is_binary(url) -> byte_size(url) > @max_url_bytes
           _ -> false
         end
       end) do
      {:error, ErrorCat.mention_url_too_long()}
    else
      {:ok, written}
    end
  end

  def mentions(_), do: {:error, :invalid_mention_ast}

  defp written_references(ast) when is_list(ast) do
    ast
    |> Enum.with_index()
    |> Enum.flat_map(fn {node, index} ->
      block_id = node_block_id(node)
      collect_mentions_from_node(node, block_id, [index])
    end)
  end

  defp collect_mentions_from_node(%{"type" => "mention"} = node, block_id, path) do
    node
    |> parse_inline_mention(block_id, path)
    |> List.wrap()
    |> Enum.reject(&is_nil/1)
    |> Kernel.++(collect_children_mentions(node, block_id, path))
  end

  defp collect_mentions_from_node(%{"type" => type} = node, block_id, path)
       when type in ["a", "link"] do
    href = Map.get(node, "url") || Map.get(node, "href")

    link_mentions =
      if is_binary(href) and href != "" do
        parse_link_mention(href, block_id, path)
      else
        []
      end

    link_mentions ++ collect_children_mentions(node, block_id, path)
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
        editor_target_id: Map.get(node, "key"),
        block_id: block_id,
        path: path,
        display: inline_mention_display(node),
        normalized_from: "inline_mention"
      })
    else
      _ -> nil
    end
  end

  defp inline_mention_type(%{"key" => key}) when is_binary(key) do
    case String.split(key, ":", parts: 2) do
      [type, _id] -> parse_mention_type(type)
      _ -> {:error, ErrorCat.invalid_mention_type()}
    end
  end

  defp inline_mention_type(_), do: {:error, ErrorCat.invalid_mention_type()}

  defp inline_mention_value(:user, %{"key" => "user:" <> login}), do: login
  defp inline_mention_value(:user, _), do: nil

  defp inline_mention_value(_type, %{"key" => key}) when is_binary(key) do
    case String.split(key, ":", parts: 2) do
      [_type, id] when id != "" -> id
      _ -> nil
    end
  end

  defp inline_mention_value(_, _), do: nil

  defp inline_mention_display(%{"children" => children} = node) when is_list(children) do
    display =
      children
      |> Enum.map(&extract_text/1)
      |> Enum.reject(&(&1 == ""))
      |> Enum.join(" ")

    if display == "", do: Map.get(node, "value", ""), else: display
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
      mention_case: :link,
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
    case article_path_from_url(url) do
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
  defp article_path_from_url(url) do
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
                   value: {:article_path, community, inner}
                 }}

              "comment-" <> comment_inner_id ->
                case Integer.parse(comment_inner_id) do
                  {comment_inner, ""} when comment_inner > 0 ->
                    {:ok,
                     %{
                       scope: :internal,
                       type: :comment,
                       value: {:comment_path, community, thread, inner, comment_inner}
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
