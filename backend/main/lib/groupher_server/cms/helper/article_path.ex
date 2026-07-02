defmodule GroupherServer.CMS.Helper.ArticlePath do
  @moduledoc """
  Normalize the public article path used by GraphQL and CMS helpers.

  `ArticlePathInput` is a public locator: `community + thread + inner_id`.
  It is not the article table primary key. Keep this module pure so web
  middleware can prepare permission context without loading the article.
  """

  alias GroupherServer.CMS.Artiment.Threads

  @type t :: %{
          community: term(),
          thread: atom(),
          inner_id: integer() | String.t()
        }

  @spec normalize(map(), keyword()) :: {:ok, t()} | {:error, :invalid_article_path}
  def normalize(article_path, opts \\ [])

  def normalize(%{} = article_path, opts) do
    fixed_thread = Keyword.get(List.wrap(opts), :thread)

    with {:ok, inner_id} <- fetch_required(article_path, :inner_id),
         {:ok, community} <- fetch_required(article_path, :community),
         {:ok, thread} <- fetch_thread(article_path, fixed_thread) do
      {:ok, %{community: community, thread: thread, inner_id: inner_id}}
    else
      _ -> {:error, :invalid_article_path}
    end
  end

  def normalize(_, _), do: {:error, :invalid_article_path}

  @spec put_normalized(map(), keyword()) :: {:ok, map()} | {:error, :invalid_article_path}
  def put_normalized(arguments, opts \\ []) when is_map(arguments) do
    # Prefer an already-normalized value so Passport and ArticleLoader can share
    # the same path without repeating parsing work or changing middleware order.
    article_path = Map.get(arguments, :article_path) || Map.get(arguments, :article)

    with {:ok, article_path} <- normalize(article_path, opts) do
      {:ok, Map.put(arguments, :article_path, article_path)}
    end
  end

  defp fetch_required(map, key) do
    map
    |> fetch_value(key_variants(key))
    |> case do
      nil -> :error
      value -> {:ok, value}
    end
  end

  defp fetch_thread(map, fixed_thread) do
    input_thread = fetch_value(map, key_variants(:thread))

    with {:ok, fixed_thread} <- normalize_optional_thread(fixed_thread),
         {:ok, input_thread} <- normalize_optional_thread(input_thread) do
      cond do
        is_nil(input_thread) and is_nil(fixed_thread) -> :error
        is_nil(input_thread) -> {:ok, fixed_thread}
        is_nil(fixed_thread) -> {:ok, input_thread}
        input_thread == fixed_thread -> {:ok, input_thread}
        true -> :error
      end
    end
  end

  defp normalize_optional_thread(nil), do: {:ok, nil}

  defp normalize_optional_thread(thread) do
    case Threads.to_atom(thread) do
      {:ok, thread} -> {:ok, thread}
      {:error, _} -> normalize_string_thread(thread)
    end
  end

  defp normalize_string_thread(thread) when is_binary(thread) do
    normalized_thread = String.downcase(thread)

    Threads.enums()
    |> Enum.find(&(to_string(&1) == normalized_thread))
    |> case do
      nil -> :error
      thread -> {:ok, thread}
    end
  end

  defp normalize_string_thread(_), do: :error

  defp fetch_value(map, keys) do
    keys
    |> Enum.find_value(fn key ->
      case Map.fetch(map, key) do
        {:ok, value} -> value
        :error -> nil
      end
    end)
  end

  defp key_variants(:inner_id), do: [:inner_id, :innerId, "inner_id", "innerId"]
  defp key_variants(:community), do: [:community, "community"]
  defp key_variants(:thread), do: [:thread, "thread"]
end
