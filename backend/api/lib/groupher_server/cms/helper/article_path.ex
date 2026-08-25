defmodule GroupherServer.CMS.Helper.ArticlePath do
  @moduledoc """
  Parse the public article path used by GraphQL and CMS helpers.

  `ArticlePathInput` is a public locator: `community + thread + inner_id`.
  It is not the article table primary key. Keep this module pure so web
  middleware can prepare permission context without loading the article.

  Examples:

      iex> ArticlePath.parse(%{community: "home", thread: :post, inner_id: "12"})
      {:ok, %{community: "home", thread: :post, inner_id: "12"}}

      iex> ArticlePath.parse(%{community: "home", thread: :post, inner_id: "12"}, thread: :post)
      {:ok, %{community: "home", thread: :post, inner_id: "12"}}

      iex> ArticlePath.parse(%{community: "home", thread: :blog, inner_id: "12"}, thread: :post)
      {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_article_path}}

      iex> ArticlePath.parse_arguments(%{article: %{community: "home", thread: :post, inner_id: "12"}})
      {:ok, %{article: %{community: "home", thread: :post, inner_id: "12"}, article_path: %{community: "home", thread: :post, inner_id: "12"}}}

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> ArticlePath
        -> Repo / external boundary
  """

  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.ErrorCat

  @type t :: %{
          community: String.t(),
          thread: atom(),
          inner_id: integer() | String.t()
        }

  @doc """
  Parses one public article path into the internal shape used by CMS code.

  This function expects the Absinthe/backend shape: atom keys and an enum atom
  for `thread`. The optional `:thread` option is a guard only; it validates the
  input thread but never fills in a missing one.

      iex> ArticlePath.parse(%{community: "home", thread: :post, inner_id: "12"})
      {:ok, %{community: "home", thread: :post, inner_id: "12"}}

      iex> ArticlePath.parse(%{community: "home", thread: :post, inner_id: "12"}, thread: :post)
      {:ok, %{community: "home", thread: :post, inner_id: "12"}}
  """
  @spec parse(map(), keyword()) ::
          {:ok, t()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def parse(article_path, opts \\ [])

  def parse(%{community: community, thread: thread, inner_id: inner_id}, opts) do
    fixed_thread = Keyword.get(opts, :thread)

    with :ok <- validate_community(community),
         :ok <- validate_inner_id(inner_id),
         {:ok, thread} <- parse_thread(thread),
         :ok <- validate_fixed_thread(thread, fixed_thread) do
      {:ok, %{community: community, thread: thread, inner_id: inner_id}}
    else
      _ -> {:error, ErrorCat.invalid_article_path()}
    end
  end

  def parse(_, _), do: {:error, ErrorCat.invalid_article_path()}

  @doc """
  Parses the article path embedded in resolver or middleware arguments.

  `:article_path` wins over raw `:article` because earlier middleware may have
  already parsed the path for permission checks. The returned arguments keep the
  original keys and add/replace `:article_path` with the parsed value.

      iex> ArticlePath.parse_arguments(%{article: %{community: "home", thread: :post, inner_id: "12"}})
      {:ok, %{article: %{community: "home", thread: :post, inner_id: "12"}, article_path: %{community: "home", thread: :post, inner_id: "12"}}}
  """
  @spec parse_arguments(map(), keyword()) ::
          {:ok, map()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def parse_arguments(arguments, opts \\ []) when is_map(arguments) do
    # Prefer an already parsed value so Passport and article loading can share
    # the same path without repeating validation or changing middleware order.
    article_path = Map.get(arguments, :article_path) || Map.get(arguments, :article)

    with {:ok, article_path} <- parse(article_path, opts) do
      {:ok, Map.put(arguments, :article_path, article_path)}
    end
  end

  defp validate_community(community) when is_binary(community), do: :ok

  defp validate_community(_), do: :error

  defp validate_inner_id(inner_id) when is_binary(inner_id) or is_integer(inner_id), do: :ok

  defp validate_inner_id(_), do: :error

  defp validate_fixed_thread(_thread, nil), do: :ok

  defp validate_fixed_thread(thread, fixed_thread) do
    with {:ok, fixed_thread} <- parse_thread(fixed_thread),
         true <- thread == fixed_thread do
      :ok
    else
      _ -> :error
    end
  end

  defp parse_thread(thread) when is_atom(thread), do: Threads.to_atom(thread)

  defp parse_thread(_), do: :error
end
