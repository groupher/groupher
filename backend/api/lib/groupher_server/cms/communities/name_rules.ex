defmodule GroupherServer.CMS.Communities.NameRules do
  @moduledoc """
  Pure syntax and reserved-name rules for the shared community slug namespace.

  This module does not inspect claims or communities. Occupancy and cooldown
  checks belong to `NameAvailability`.

      raw name -> normalize -> syntax/reserved rules -> normalized name or error
  """

  alias GroupherServer.{CMS}
  alias CMS.Communities.ErrorCat

  @seed_reserved ~w(dev mock tmp)
  @reserved ~w(
    home dev mock tmp dash dashboard apply api auth login logout pricing assets static _next
    graphql health press docs admin settings
  )
  @slug_pattern ~r/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

  @doc """
  Normalizes a slug by trimming whitespace, lowercasing, and niling empty input.

  ## Examples

      NameRules.normalize("  GroupHer ")
      #=> "groupher"
  """
  @spec normalize(term()) :: String.t() | nil
  def normalize(slug) when is_binary(slug) do
    slug = slug |> String.trim() |> String.downcase()
    if slug == "", do: nil, else: slug
  end

  def normalize(_), do: nil

  @doc """
  Validates syntax and reserved routes without checking namespace occupancy.

  ## Examples

      NameRules.format_check(" New-Community ")
      #=> {:ok, "new-community"}
  """
  @spec format_check(term()) :: {:ok, String.t()} | {:error, ErrorCat.error()}
  def format_check(slug) do
    slug = normalize(slug)

    cond do
      not is_binary(slug) or byte_size(slug) > 30 or not Regex.match?(@slug_pattern, slug) ->
        {:error, ErrorCat.invalid_slug()}

      slug in @reserved ->
        {:error, ErrorCat.reserved_slug()}

      true ->
        {:ok, slug}
    end
  end

  @doc """
  Returns the reserved top-level routes.

  ## Examples

      "home" in NameRules.reserved_slugs()
      #=> true
  """
  @spec reserved_slugs() :: [String.t()]
  def reserved_slugs, do: @reserved

  @doc """
  Rejects public renames into or out of the fixed acceptance namespace.

  ## Examples

      NameRules.check_seed_slug_change("dev", "other")
      #=> {:error, ErrorCat.reserved_slug()}
  """
  def check_seed_slug_change(current, candidate) do
    target = normalize(candidate)

    if target != current and (current in @seed_reserved or target in @seed_reserved) do
      {:error, ErrorCat.reserved_slug()}
    else
      {:ok, :unchanged_or_unprotected}
    end
  end
end
