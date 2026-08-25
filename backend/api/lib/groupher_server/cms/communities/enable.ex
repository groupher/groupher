defmodule GroupherServer.CMS.Communities.Enable do
  @moduledoc """
  Community-scoped policy decisions for visibility and capability checks.

  Current responsibilities:
  - thread-level emotion availability
  - thread visibility/mutability derived from dashboard enable settings
  - placeholders for broader community freeze/update rules

  Design intent:
  - system config defines the upper bound through `emotions_whitelist`
  - system config provides default thread settings through `default_thread_emotions`
  - community dashboard can override per-thread availability through `thread_emotions`
  - CMS write paths ask this module before mutating state

  Resolution order for emotion availability:

  1. community dashboard override
  2. system default for that thread
  3. filtered by `emotions_whitelist`

  Thread visibility is intentionally separate from emotion availability.
  A thread can be visible while a subset of its emotions are disabled.

  Example:

      iex> CMS.Communities.Enable.allowed_emotions("groupher", :comment, :post)
      [:beer, :heart]

      iex> CMS.Communities.Enable.allow_emotion("groupher", :comment, :post, :beer)
      {:ok, :post_comment}

      iex> CMS.Communities.Enable.allow_emotion("groupher", :comment, :post, :upvote)
      {:error, %GroupherServer.ErrorCat.Error{reason: :emotion_not_allowed}}

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Communities
        -> Repo / external boundary
  """

  import Helper.Utils, only: [done: 1]

  alias GroupherServer.CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.Communities.Config
  alias GroupherServer.CMS.FrontDesk
  alias GroupherServer.CMS.Gate.ErrorCat, as: GateErrorCat

  @threads Config.threads()
  @emotions_whitelist Config.emotions_whitelist()
  @default_thread_emotions Config.default_thread_emotions()

  @type scope :: :article | :comment

  @doc """
  Returns the thread when it is visible/enabled for the community.

  ## Examples

      CMS.Communities.Enable.allow_thread("groupher", :post)
      #=> {:ok, :post}

      CMS.Communities.Enable.allow_thread("groupher", :kanban)
      #=> {:error, %GroupherServer.ErrorCat.Error{reason: :thread_not_visible}}

  """
  @spec allow_thread(map() | String.t() | nil, atom()) ::
          {:ok, atom()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def allow_thread(community, thread) when is_atom(thread) do
    with {:ok, thread} <- Threads.to_atom(thread) do
      case thread_visible?(community, thread) do
        true -> done(thread)
        false -> {:error, ArticleErrorCat.thread_not_visible()}
      end
    end
  end

  def allow_thread(_community, _thread),
    do: {:error, GroupherServer.ErrorCat.custom("invalid thread")}

  @spec allow_emotion(String.t() | nil, scope(), atom(), atom()) ::
          {:ok, atom()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def allow_emotion(community_slug, scope, thread, emotion) when is_atom(thread) do
    with {:ok, thread} <- Threads.to_atom(thread) do
      thread_key = thread_key(scope, thread)

      case emotion_allowed?(community_slug, scope, thread, emotion) do
        true -> done(thread_key)
        false -> {:error, ArticleErrorCat.emotion_not_allowed()}
      end
    end
  end

  def allow_emotion(_community_slug, _scope, _thread, _emotion),
    do: {:error, GroupherServer.ErrorCat.custom("invalid thread")}

  @spec allow_comment(map(), term()) ::
          {:ok, map()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def allow_comment(%{meta: %{is_comment_locked: false}} = article, _user), do: done(article)

  def allow_comment(%{meta: %{is_comment_locked: true}}, _user),
    do: {:error, GateErrorCat.article_comments_locked()}

  def allow_comment(_article, _user), do: {:error, GateErrorCat.article_comments_locked()}

  @spec emotions_whitelist() :: [atom()]
  def emotions_whitelist, do: @emotions_whitelist

  @spec default_thread_emotions() :: map()
  def default_thread_emotions, do: @default_thread_emotions

  @spec thread_keys() :: [atom()]
  def thread_keys do
    @threads ++ Enum.map(@threads, &:"#{&1}_comment")
  end

  @spec allowed_emotions(String.t() | nil, scope(), atom()) :: [atom()]
  def allowed_emotions(community_slug, scope, thread) do
    thread_key = thread_key(scope, thread)
    fallback = Map.get(@default_thread_emotions, thread_key, [])

    community_slug
    |> dsb_thread_emotions_override(thread_key)
    |> case do
      nil -> fallback
      override -> override
    end
    |> Enum.filter(&(&1 in @emotions_whitelist))
  end

  defp dsb_enable(nil), do: nil

  defp dsb_enable(%{dashboard: %{enable: enable}}), do: enable

  defp dsb_enable(%{community: community_slug}) when is_binary(community_slug) do
    dsb_enable(community_slug)
  end

  defp dsb_enable(community_slug) when is_binary(community_slug) do
    case FrontDesk.community(community_slug) do
      {:ok, %{dashboard: %{enable: enable}}} -> enable
      _ -> nil
    end
  end

  defp dsb_thread_emotions_override(nil, _thread_key), do: nil

  defp dsb_thread_emotions_override(community_slug, thread_key) when is_binary(community_slug) do
    case FrontDesk.community(community_slug) do
      {:ok, %{dashboard: %{thread_emotions: thread_emotions}}} when not is_nil(thread_emotions) ->
        Map.get(thread_emotions, thread_key)

      _ ->
        nil
    end
  end

  defp dsb_thread_emotions_override(%{dashboard: %{thread_emotions: thread_emotions}}, thread_key)
       when not is_nil(thread_emotions) do
    Map.get(thread_emotions, thread_key)
  end

  defp dsb_thread_emotions_override(_, _thread_key), do: nil

  defp emotion_allowed?(community_slug, scope, thread, emotion) do
    emotion in allowed_emotions(community_slug, scope, thread)
  end

  defp thread_visible?(community, thread) do
    case dsb_enable(community) do
      nil -> true
      enable -> Map.get(enable, thread, true)
    end
  end

  defp thread_key(:article, thread), do: thread
  defp thread_key(:comment, thread), do: :"#{thread}_comment"
  @doc "Checks whether a thread is enabled for a community."
  def thread?(community, thread), do: allow_thread(community, thread)

  @doc "Checks whether one emotion is enabled for a resource thread."
  def emotion?(community, scope, thread, emotion),
    do: allow_emotion(community, scope, thread, emotion)

  @doc "Checks whether comments are enabled for an Article."
  def comment?(article), do: allow_comment(article, nil)

  @doc "Returns the enabled emotions for a resource thread."
  def emotions(community, scope, thread),
    do: allowed_emotions(community, scope, thread)
end
