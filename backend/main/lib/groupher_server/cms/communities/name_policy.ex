defmodule GroupherServer.CMS.Communities.NamePolicy do
  @moduledoc """
  Canonical V1 policy for the shared community slug namespace.

  The list mirrors public top-level routes and service namespaces. Future brand
  and dispute rules extend this module instead of adding resolver conditions.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> NamePolicy
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS.Model.{Community, CommunitySlugClaim}
  alias GroupherServer.Repo

  @reserved ~w(
    home dash dashboard apply api auth login logout pricing assets static _next
    graphql health press docs admin settings
  )
  @slug_pattern ~r/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
  @blocking_claim_statuses [:application, :community, :reserved, :disputed]

  @doc """
  Normalizes a slug: trims whitespace, lowercases, and treats an empty
  result as nil.

  ## Examples

      CMS.Communities.NamePolicy.normalize("  GroupHer ")
      #=> "groupher"

      CMS.Communities.NamePolicy.normalize("  ")
      #=> nil

  """
  @spec normalize(term()) :: String.t() | nil
  def normalize(slug) when is_binary(slug) do
    slug = slug |> String.trim() |> String.downcase()
    if slug == "", do: nil, else: slug
  end

  def normalize(_), do: nil

  @doc "Checks whether a normalized name is available in the shared namespace."
  @spec check(term(), keyword()) :: {:ok, String.t()} | {:error, atom()}
  def check(slug, opts \\ []) do
    with {:ok, slug} <- format_check(slug) do
      cond do
        blocking_claim = blocking_claim(slug, opts) ->
          {:error, claim_reason(blocking_claim)}

        Repo.exists?(from(c in Community, where: c.slug == ^slug)) ->
          {:error, :slug_claimed}

        true ->
          {:ok, slug}
      end
    end
  end

  @doc "Normalizes and validates syntax/reserved routes without checking occupancy."
  @spec format_check(term()) :: {:ok, String.t()} | {:error, atom()}
  def format_check(slug) do
    slug = normalize(slug)

    cond do
      not is_binary(slug) or byte_size(slug) > 30 or not Regex.match?(@slug_pattern, slug) ->
        {:error, :invalid_slug}

      slug in @reserved ->
        {:error, :reserved_slug}

      true ->
        {:ok, slug}
    end
  end

  defp blocking_claim(slug, opts) do
    query =
      from(claim in CommunitySlugClaim,
        where:
          claim.slug == ^slug and is_nil(claim.released_at) and
            claim.status in ^@blocking_claim_statuses,
        order_by: [asc: claim.inserted_at]
      )

    query = exclude_application_claim(query, Keyword.get(opts, :ignore_application_id))

    query
    |> Repo.all()
    |> List.first()
    |> case do
      %CommunitySlugClaim{} = claim -> claim
      nil -> cooldown_claim(slug)
    end
  end

  defp exclude_application_claim(query, nil), do: query

  defp exclude_application_claim(query, application_id) do
    from(claim in query,
      where: is_nil(claim.application_id) or claim.application_id != ^application_id
    )
  end

  defp cooldown_claim(slug) do
    now = DateTime.utc_now(:second)

    Repo.one(
      from(claim in CommunitySlugClaim,
        where:
          claim.slug == ^slug and is_nil(claim.released_at) and
            claim.status == :cooldown and
            (is_nil(claim.cooldown_until) or claim.cooldown_until > ^now),
        order_by: [asc: claim.inserted_at]
      )
    )
  end

  defp claim_reason(%CommunitySlugClaim{status: :reserved}), do: :reserved_slug
  defp claim_reason(%CommunitySlugClaim{status: :disputed}), do: :slug_disputed
  defp claim_reason(%CommunitySlugClaim{status: :cooldown}), do: :slug_in_cooldown
  defp claim_reason(%CommunitySlugClaim{}), do: :slug_claimed

  @spec reserved_slugs() :: [String.t()]
  def reserved_slugs, do: @reserved
end
