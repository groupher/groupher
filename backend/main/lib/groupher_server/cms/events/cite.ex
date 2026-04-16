defmodule GroupherServer.CMS.Events.Cite do
  @moduledoc """
  run tasks in every article blocks if need

  current task: "cite link" and "mention"

  ## cite link

  我被站内哪些文章或评论引用了，是值得关注的事
  我引用了谁不重要，帖子里链接已经表明了, 这和 github issue 的双向链接不一样，因为一般不需要关注这个
  帖子是否解决，是否被 merge 等状态。

  基本结构：

  cited_thread, cited_article_id, [xxx_article]_id, [block_id, block2_id],

  POST post_333 -> cited_article_333, [block_id, block2_id]]

  cited_type, cited_artiment_id, [contents]_id, [block_id, cited_block_id],

  cited_type: thread or comment
  artiment: article or comment
  # cited_comment_id, [xxx_article]_id, [block_id, block2_id, ...],

  注意 cited_by_type 不能命名为 cited_by_thread

  因为 cited_by_thread 无法表示这样的语义:
  # 某评论被 post 以 comment link 的方式引用了
  """

  import Ecto.Query, warn: false

  import GroupherServer.CMS.Helper.Matcher
  import Helper.Utils, only: [get_config: 2]
  import GroupherServer.CMS.Events.Helper, only: [merge_same_block_linker: 2]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Events.{CitedArtiment, Event}
  alias CMS.{FrontDesk, Helper.Threads}
  alias CMS.Model.Comment
  alias Helper.ContentPipeline
  alias Helper.Multi

  @site_host get_config(:general, :site_host)
  @article_threads get_config(:article, :threads)
  @valid_article_prefix Enum.map(@article_threads, &"#{@site_host}/#{&1}/")
  @href_regex ~r/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i

  @type cite_result :: {:ok, list()} | {:error, map()}
  @type handle_result :: {:ok, term()} | {:error, term()}

  @behaviour GroupherServer.CMS.Events.Handler

  @spec handle(Event.t()) :: handle_result()
  @impl true
  def handle(%Event{type: :cite, payload: %{artiment: artiment}}) do
    handle(artiment)
  end

  @spec handle(Comment.t() | map()) :: cite_result()
  def handle(%{body: body} = artiment) when not is_nil(body) do
    with {:ok, ast} <- ContentPipeline.decode(body),
         {:ok, artiment} <- FrontDesk.preload_author(artiment) do
      Multi.new()
      |> Multi.run(:delete_all_cited_artiments, fn _, _ ->
        CitedArtiment.batch_delete_by(artiment)
      end)
      |> Multi.run(:update_cited_info, fn _, _ ->
        ast
        |> parse_cited_from_ast(artiment)
        |> merge_same_block_linker(:cited_by_id)
        |> CitedArtiment.batch_insert()
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec handle(map()) :: cite_result()
  def handle(%{document: _document} = article) do
    with {:ok, ast} <- load_document_ast(article),
         {:ok, artiment} <- FrontDesk.preload_author(article) do
      Multi.new()
      |> Multi.run(:delete_all_cited_artiments, fn _, _ ->
        CitedArtiment.batch_delete_by(artiment)
      end)
      |> Multi.run(:update_cited_info, fn _, _ ->
        ast
        |> parse_cited_from_ast(artiment)
        |> merge_same_block_linker(:cited_by_id)
        |> CitedArtiment.batch_insert()
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp parse_links_in_block(artiment, block_id, links) do
    Enum.reduce(links, [], fn link, acc ->
      case parse_valid_cited(artiment, link) do
        {:ok, cited} -> List.insert_at(acc, 0, shape(artiment, cited, block_id))
        _ -> acc
      end
    end)
    |> Enum.uniq()
  end

  defp load_document_ast(article) do
    case Repo.preload(article, :document) |> get_in([:document, :json]) do
      nil -> {:ok, []}
      json when is_binary(json) -> ContentPipeline.decode(json)
      _ -> {:error, {:custom, "invalid json body"}}
    end
  end

  defp parse_cited_from_ast(ast, artiment) when is_list(ast) do
    Enum.reduce(ast, [], fn node, acc ->
      block_id = node_block_id(node)
      links = collect_links_from_node(node)
      acc ++ parse_links_in_block(artiment, block_id, links)
    end)
  end

  defp parse_cited_from_ast(_, _), do: []

  defp collect_links_from_node(%{"text" => text}) when is_binary(text),
    do: extract_links_by_regex(text)

  defp collect_links_from_node(%{"children" => children}) when is_list(children) do
    Enum.reduce(children, [], fn node, acc -> acc ++ collect_links_from_node(node) end)
  end

  defp collect_links_from_node(_), do: []

  defp node_block_id(%{"id" => block_id}) when is_binary(block_id), do: block_id
  defp node_block_id(%{"_id" => block_id}) when is_binary(block_id), do: block_id
  defp node_block_id(_), do: "block-unknown"

  defp parse_valid_cited(artiment, link) do
    with {:ok, cited} <- parse_cited_in_link(link) do
      case not citing_itself?(artiment, cited) do
        true -> {:ok, cited}
        false -> {:error, {:custom, "citing itself, ignored"}}
      end
    end
  end

  defp extract_links_by_regex(text) do
    Regex.scan(@href_regex, text, capture: :all_but_first)
    |> Enum.map(fn captures ->
      Enum.find(captures, fn part -> is_binary(part) and part != "" end)
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp parse_cited_in_link({"a", attrs, _}) do
    with {:ok, link} <- parse_link(attrs),
         true <- site_article_link?(link) do
      case link_for_comment?(link) do
        true -> load_cited_comment_from_url(link)
        false -> load_cited_article_from_url(link)
      end
    end
  end

  defp parse_cited_in_link(link) when is_binary(link) do
    with true <- site_article_link?(link) do
      case link_for_comment?(link) do
        true -> load_cited_comment_from_url(link)
        false -> load_cited_article_from_url(link)
      end
    end
  end

  defp parse_link(attrs) do
    case Enum.find(attrs, fn {a, _v} -> a == "href" end) do
      {"href", link} -> {:ok, link}
      _ -> {:error, {:custom, "invalid fmt"}}
    end
  end

  defp load_cited_comment_from_url(url) do
    %{query: query} = URI.parse(url)

    try do
      comment_id = URI.decode_query(query) |> Map.get("comment_id")

      with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
        {:ok, %{type: :comment, artiment: comment}}
      end
    rescue
      _ -> {:error, {:custom, "load comment error"}}
    end
  end

  defp load_cited_article_from_url(url) do
    %{path: path} = URI.parse(url)
    path_list = path |> String.split("/")
    article_id = path_list |> Enum.at(2)

    with {:ok, thread} <- parse_thread_slug(path_list |> Enum.at(1)),
         {:ok, info} <- match(thread),
         {:ok, article} <- FrontDesk.get(info.model, article_id) do
      {:ok, %{type: :article, artiment: article}}
    end
  end

  defp parse_thread_slug(slug) when is_binary(slug) do
    normalized = String.downcase(slug)

    case Enum.find(Threads.article_enums(), fn thread -> Atom.to_string(thread) == normalized end) do
      nil -> {:error, {:custom, "invalid thread"}}
      thread -> {:ok, thread}
    end
  end

  defp parse_thread_slug(_), do: {:error, {:custom, "invalid thread"}}

  defp citing_itself?(%Comment{id: source_id}, %{type: :comment, artiment: %{id: target_id}}),
    do: source_id == target_id

  defp citing_itself?(%Comment{}, %{type: :article}), do: false

  defp citing_itself?(_article, %{type: :comment}), do: false

  defp citing_itself?(article, %{type: :article, artiment: target}) do
    with {:ok, source_thread} <- FrontDesk.thread_of(article),
         {:ok, target_thread} <- FrontDesk.thread_of(target) do
      article.id == target.id and source_thread == target_thread
    else
      _ -> false
    end
  end

  defp site_article_link?(url) do
    Enum.any?(@valid_article_prefix, &String.starts_with?(url, &1))
  end

  defp link_for_comment?(url) do
    with %{query: query} <- URI.parse(url) do
      not is_nil(query) and String.starts_with?(query, "comment_id=")
    end
  end

  defp shape(%Comment{} = comment, %{type: :article, artiment: cited}, block_id) do
    %{
      cited_by_id: cited.id,
      cited_by_type: cited.meta.thread,
      comment_id: comment.id,
      block_linker: [block_id],
      user_id: comment.author_id,
      artiment: cited,
      citing_time: comment.updated_at |> DateTime.truncate(:second)
    }
  end

  defp shape(%Comment{} = comment, %{type: :comment, artiment: cited}, block_id) do
    %{
      cited_by_id: cited.id,
      cited_by_type: :comment,
      comment_id: comment.id,
      block_linker: [block_id],
      user_id: comment.author_id,
      artiment: cited,
      citing_time: comment.updated_at |> DateTime.truncate(:second)
    }
  end

  defp shape(article, %{type: :article, artiment: cited}, block_id) do
    {:ok, thread} = FrontDesk.thread_of(article)
    {:ok, info} = match(thread)

    %{
      cited_by_id: cited.id,
      cited_by_type: cited.meta.thread,
      block_linker: [block_id],
      user_id: article.author.user.id,
      artiment: cited,
      citing_time: article.updated_at |> DateTime.truncate(:second)
    }
    |> Map.put(info.foreign_key, article.id)
  end

  defp shape(article, %{type: :comment, artiment: cited}, block_id) do
    {:ok, thread} = FrontDesk.thread_of(article)
    {:ok, info} = match(thread)

    %{
      cited_by_id: cited.id,
      cited_by_type: :comment,
      block_linker: [block_id],
      user_id: article.author.user.id,
      artiment: cited,
      citing_time: article.updated_at |> DateTime.truncate(:second)
    }
    |> Map.put(info.foreign_key, article.id)
  end

  defp result({:ok, %{update_cited_info: result}}), do: {:ok, result}

  defp result({:error, :update_cited_info, _result, _steps}) do
    {:error, {:cite_article, "cited article"}}
  end
end
