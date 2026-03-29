defmodule GroupherServer.CMS.CanCan.Communities do
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

      iex> CMS.CanCan.Communities.allowed_emotions("groupher", :comment, :post)
      [:beer, :heart]

      iex> CMS.CanCan.Communities.emotion_allowed?("groupher", :comment, :post, :beer)
      true

      iex> CMS.CanCan.Communities.ensure_emotion_allowed("groupher", :comment, :post, :upvote)
      {:error, :emotion_not_allowed}
  """

  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS.FrontDesk

  @article_threads get_config(:article, :threads)
  @emotions_whitelist get_config(:article, :emotions_whitelist)
  @default_thread_emotions get_config(:article, :default_thread_emotions)

  @type scope :: :article | :comment

  @spec emotion_allowed?(String.t() | nil, scope(), atom() | String.t(), atom()) :: boolean()
  def emotion_allowed?(community_slug, scope, thread, emotion) do
    emotion in allowed_emotions(community_slug, scope, thread)
  end

  @spec thread_visible?(map() | String.t() | nil, atom() | String.t()) :: boolean()
  def thread_visible?(community, thread) do
    thread_key = normalize_thread(thread)

    case dashboard_enable(community) do
      nil -> true
      enable -> Map.get(enable, thread_key, true)
    end
  end

  @spec thread_mutable?(map() | String.t() | nil, atom() | String.t()) :: boolean()
  def thread_mutable?(community, thread) do
    thread_visible?(community, thread) and not community_frozen?(community)
  end

  @spec community_frozen?(map() | String.t() | nil) :: boolean()
  def community_frozen?(_community), do: false

  @spec publishable?(map() | String.t() | nil, atom() | String.t(), map() | nil) :: boolean()
  def publishable?(community, thread, _user) do
    thread_mutable?(community, thread)
  end

  @spec dashboard_updatable?(map() | String.t() | nil, map() | nil) :: boolean()
  def dashboard_updatable?(community, _user) do
    not community_frozen?(community)
  end

  @spec ensure_emotion_allowed(String.t() | nil, scope(), atom() | String.t(), atom()) ::
          :ok | {:error, atom()}
  def ensure_emotion_allowed(community_slug, scope, thread, emotion) do
    case emotion_allowed?(community_slug, scope, thread, emotion) do
      true -> :ok
      false -> {:error, :emotion_not_allowed}
    end
  end

  @spec emotions_whitelist() :: [atom()]
  def emotions_whitelist, do: @emotions_whitelist

  @spec default_thread_emotions() :: map()
  def default_thread_emotions, do: @default_thread_emotions

  @spec thread_keys() :: [atom()]
  def thread_keys do
    @article_threads ++ Enum.map(@article_threads, &:"#{&1}_comment")
  end

  @spec allowed_emotions(String.t() | nil, scope(), atom() | String.t()) :: [atom()]
  def allowed_emotions(community_slug, scope, thread) do
    thread_key = thread_key(scope, thread)
    fallback = Map.get(@default_thread_emotions, thread_key, [])

    community_slug
    |> community_override(thread_key)
    |> case do
      nil -> fallback
      override -> override
    end
    |> Enum.filter(&(&1 in @emotions_whitelist))
  end

  defp dashboard_enable(nil), do: nil

  defp dashboard_enable(%{dashboard: %{enable: enable}}), do: enable

  defp dashboard_enable(community_slug) when is_binary(community_slug) do
    case FrontDesk.community(community_slug) do
      {:ok, %{dashboard: %{enable: enable}}} -> enable
      _ -> nil
    end
  end

  defp community_override(nil, _thread_key), do: nil

  defp community_override(community_slug, thread_key) when is_binary(community_slug) do
    case FrontDesk.community(community_slug) do
      {:ok, %{dashboard: %{thread_emotions: thread_emotions}}} when not is_nil(thread_emotions) ->
        Map.get(thread_emotions, thread_key)

      _ ->
        nil
    end
  end

  defp community_override(%{dashboard: %{thread_emotions: thread_emotions}}, thread_key)
       when not is_nil(thread_emotions) do
    Map.get(thread_emotions, thread_key)
  end

  defp community_override(_, _thread_key), do: nil

  defp thread_key(:article, thread), do: normalize_thread(thread)
  defp thread_key(:comment, thread), do: :"#{normalize_thread(thread)}_comment"

  defp normalize_thread(thread) when is_atom(thread), do: thread

  defp normalize_thread(thread) when is_binary(thread) do
    thread |> String.downcase() |> String.to_atom()
  end
end
