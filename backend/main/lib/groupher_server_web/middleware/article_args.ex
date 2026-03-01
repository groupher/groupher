defmodule GroupherServerWeb.Middleware.ArticleArgs do
  @moduledoc """
  Normalize `article` input into common args (`id`, `community`, `thread`).

  - with `thread: <fixed_thread>` option: thread is constrained to the fixed value
  - without `thread` option: thread comes from input and defaults to `:post`
  """

  @behaviour Absinthe.Middleware

  import Helper.ErrorCode
  import Helper.Utils, only: [handle_absinthe_error: 3]

  def call(%{errors: errors} = resolution, _) when length(errors) > 0 do
    resolution
  end

  def call(%{arguments: %{article: article_ref} = arguments} = resolution, opts) do
    fixed_thread = Keyword.get(List.wrap(opts), :thread)

    with {:ok, inner_id} <- fetch_required(article_ref, :inner_id),
         {:ok, community} <- fetch_required(article_ref, :community),
         {:ok, thread} <- fetch_thread(article_ref, fixed_thread) do
      normalized_arguments =
        arguments
        |> Map.merge(%{id: inner_id, community: community, thread: thread})

      %{resolution | arguments: normalized_arguments}
    else
      :error ->
        resolution
        |> handle_absinthe_error("invalid article input", ecode(:custom))
    end
  end

  def call(resolution, _) do
    resolution
    |> handle_absinthe_error("missing article input", ecode(:custom))
  end

  defp fetch_required(map, key) do
    case Map.fetch(map, key) do
      {:ok, nil} -> :error
      {:ok, value} -> {:ok, value}
      :error -> :error
    end
  end

  defp fetch_thread(map, fixed_thread) do
    case Map.fetch(map, :thread) do
      {:ok, nil} ->
        if is_nil(fixed_thread), do: {:ok, :post}, else: {:ok, fixed_thread}

      {:ok, value} ->
        cond do
          is_nil(fixed_thread) -> {:ok, value}
          value == fixed_thread -> {:ok, value}
          true -> :error
        end

      :error ->
        if is_nil(fixed_thread), do: {:ok, :post}, else: {:ok, fixed_thread}
    end
  end
end
