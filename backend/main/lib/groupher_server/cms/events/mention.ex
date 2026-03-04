defmodule GroupherServer.CMS.Events.Mention do
  @moduledoc """
  events for mention task

  parse and fmt(see shape function) mentions to Messaging module
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [get_config: 2]

  import GroupherServer.CMS.Events.Helper, only: [merge_same_block_linker: 2]

  alias GroupherServer.{Accounts, CMS, Messaging, Repo}

  alias CMS.Events.Event
  alias CMS.FrontDesk
  alias CMS.Model.Comment

  @article_threads get_config(:article, :threads)

  @article_mention_class "cdx-mention"
  @mention_regex ~r/<(?:a|div)\b[^>]*class\s*=\s*(?:"[^"]*cdx-mention[^"]*"|'[^']*cdx-mention[^']*'|[^\s>]*cdx-mention[^\s>]*)[^>]*>([^<]*)<\/(?:a|div)>/i

  @type mention_result :: {:ok, list()} | {:error, map()}
  @type handle_result :: {:ok, term()} | {:error, term()}

  @behaviour GroupherServer.CMS.Events.Handler

  @spec handle(Event.t()) :: handle_result()
  @impl true
  def handle(%Event{type: :mention, payload: %{artiment: artiment}}) do
    handle(artiment)
  end

  @spec handle(Comment.t() | map()) :: mention_result()
  def handle(%{body: body} = artiment) when not is_nil(body) do
    with {:ok, %{"blocks" => blocks}} <- Jason.decode(body),
         {:ok, artiment} <- FrontDesk.preload_author(artiment) do
      blocks
      |> Enum.reduce([], &(&2 ++ parse_mention_info_per_block(artiment, &1)))
      |> merge_same_block_linker(:to_user_id)
      |> handle_mentions(artiment)
    end
  end

  @spec handle(map()) :: mention_result()
  def handle(%{document: _document} = article) do
    body = Repo.preload(article, :document) |> get_in([:document, :body])
    article = article |> Map.put(:body, body)
    handle(article)
  end

  @spec handle_mentions(list(), Comment.t() | map()) :: mention_result()
  defp handle_mentions(mentions, artiment) do
    with {:ok, author} <- FrontDesk.author_of(artiment) do
      Messaging.send_mention(artiment, mentions, author)
    end
  end

  defp parse_mention_info_per_block(artiment, %{"id" => block_id, "data" => %{"text" => text}}) do
    mentions = extract_mentions(text)

    parse_mention_in_block(artiment, block_id, mentions)
  end

  defp extract_mentions(text) do
    floki_mentions = Floki.find(text, ".#{@article_mention_class}")

    if floki_mentions == [] do
      extract_mentions_by_regex(text)
    else
      floki_mentions
    end
  end

  defp extract_mentions_by_regex(text) do
    Regex.scan(@mention_regex, text, capture: :all_but_first)
    |> Enum.map(fn [user_login] -> String.trim(user_login) end)
    |> Enum.reject(&(&1 == ""))
  end

  defp parse_mention_in_block(artiment, block_id, mentions) do
    Enum.reduce(mentions, [], fn mention, acc ->
      case parse_mention_user_id(artiment, mention) do
        {:ok, user_id} -> List.insert_at(acc, 0, shape(artiment, user_id, block_id))
        {:error, _} -> acc
      end
    end)
    |> Enum.uniq()
  end

  defp parse_mention_user_id(artiment, {_, _, [user_login]}) do
    with {:ok, author} <- FrontDesk.author_of(artiment),
         {:ok, user_id} <- Accounts.FrontDesk.userid(user_login) do
      case author.id !== user_id do
        true -> {:ok, user_id}
        false -> {:error, {:custom, "mention yourself, ignored"}}
      end
    end
  end

  defp parse_mention_user_id(artiment, user_login) when is_binary(user_login) do
    with {:ok, author} <- FrontDesk.author_of(artiment),
         {:ok, user_id} <- Accounts.FrontDesk.userid(user_login) do
      case author.id !== user_id do
        true -> {:ok, user_id}
        false -> {:error, {:custom, "mention yourself, ignored"}}
      end
    end
  end

  defp shape(%Comment{} = comment, mention_user_id, block_id) do
    article_thread = @article_threads |> Enum.find(&(not is_nil(Map.get(comment, :"#{&1}_id"))))
    comment = Repo.preload(comment, article_thread)
    parent_article = comment |> Map.get(article_thread)

    %{
      thread: article_thread,
      title: parent_article.title,
      article_id: parent_article.id,
      comment_id: comment.id,
      block_linker: [block_id],
      read: false,
      from_user_id: comment.author_id,
      to_user_id: mention_user_id,
      inserted_at: comment.updated_at |> DateTime.truncate(:second),
      updated_at: comment.updated_at |> DateTime.truncate(:second)
    }
  end

  defp shape(article, to_user_id, block_id) do
    {:ok, thread} = FrontDesk.thread_of(article)

    %{
      thread: thread,
      title: article.title,
      article_id: article.id,
      block_linker: [block_id],
      read: false,
      from_user_id: article.author.user_id,
      to_user_id: to_user_id,
      inserted_at: article.updated_at |> DateTime.truncate(:second),
      updated_at: article.updated_at |> DateTime.truncate(:second)
    }
  end
end
