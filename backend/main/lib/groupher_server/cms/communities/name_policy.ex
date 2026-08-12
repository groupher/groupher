defmodule GroupherServer.CMS.Communities.NamePolicy do
  @moduledoc """
  Canonical V1 policy for the shared community slug namespace.

  The list mirrors public top-level routes and service namespaces. Future brand
  and dispute rules extend this module instead of adding resolver conditions.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.Repo

  @reserved ~w(
    home dash dashboard apply api auth login logout pricing assets static _next
    graphql health press docs admin settings
  )
  @slug_pattern ~r/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

  @spec normalize(term()) :: String.t() | nil
  def normalize(slug) when is_binary(slug) do
    slug = slug |> String.trim() |> String.downcase()
    if slug == "", do: nil, else: slug
  end

  def normalize(_), do: nil

  @spec validate(term()) :: {:ok, String.t()} | {:error, atom()}
  def validate(slug) do
    slug = normalize(slug)

    cond do
      not is_binary(slug) or byte_size(slug) > 30 or not Regex.match?(@slug_pattern, slug) ->
        {:error, :invalid_slug}

      slug in @reserved ->
        {:error, :reserved_slug}

      Repo.exists?(from(c in Community, where: c.slug == ^slug)) ->
        {:error, :slug_claimed}

      true ->
        {:ok, slug}
    end
  end

  @spec reserved_slugs() :: [String.t()]
  def reserved_slugs, do: @reserved
end
