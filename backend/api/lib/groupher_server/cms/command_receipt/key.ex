defmodule GroupherServer.CMS.CommandReceipt.Key do
  @moduledoc """
  Resolves and validates the stable UUID identity for one CMS command attempt.

      direct key / option container
        -> Key
        -> validated UUID or command_key_required
  """

  alias GroupherServer.CMS.ErrorCat

  @doc """
  Resolves a direct command key or extracts one from an option container.

  A missing key is equivalent to `nil` and creates an internal one-shot key.
  A key that is present but invalid fails closed instead of being replaced.
  """
  @spec resolve(term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  def resolve(opts) when is_map(opts), do: opts |> from_options() |> resolve()

  def resolve(opts) when is_list(opts) do
    if Keyword.keyword?(opts),
      do: opts |> from_options() |> resolve(),
      else: {:error, ErrorCat.command_key_required()}
  end

  def resolve(nil), do: {:ok, Ecto.UUID.generate()}

  def resolve(key) when is_binary(key) do
    case Ecto.UUID.cast(key) do
      {:ok, uuid} -> {:ok, uuid}
      :error -> {:error, ErrorCat.command_key_required()}
    end
  end

  def resolve(_key), do: {:error, ErrorCat.command_key_required()}

  @doc """
  Resolves a primary option container, falling back to a secondary one.

  Fallback is used only when the primary container has no key or has an
  explicit `nil` key. An invalid primary container or key fails closed so a
  malformed retry cannot silently acquire a different identity.
  """
  @spec resolve(term(), term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  def resolve(primary, fallback) do
    primary
    |> from_options()
    |> case do
      nil -> fallback |> from_options() |> resolve()
      key -> resolve(key)
    end
  end

  defp from_options(opts) when is_map(opts),
    do: Map.get(opts, :command_key) || Map.get(opts, "command_key")

  defp from_options(opts) when is_list(opts) do
    if Keyword.keyword?(opts), do: Keyword.get(opts, :command_key), else: opts
  end

  defp from_options(opts), do: opts
end
