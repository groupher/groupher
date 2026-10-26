defmodule GroupherServer.CMS.Gate.Scope.ReviewRead do
  @moduledoc """
  Resolves the actor's review-read grants for public Article, Doc, and Comment scopes.

  Scope query filters use these Passport facts only to admit content protected by
  matching active review restrictions; the surrounding Gate predicates still
  enforce resource and ancestor visibility.

      Actor Passport
        -> ReviewRead grants -> Gate Scope restriction filters
  """

  alias GroupherServer.{CMS, Accounts}
  alias Accounts.Model.User

  @doc "Returns platform review access and every community slug readable by the actor."
  def grants(%User{cur_passport: passport}) do
    normalized = CMS.Passport.Registry.normalize_rules(passport)

    community_slugs =
      normalized
      |> Map.keys()
      |> Enum.reject(&(&1 == "global"))
      |> Enum.filter(fn slug ->
        CMS.Passport.Authorization.allowed?(normalized, slug, CMS.GateAction.review_read()) ==
          {:ok, true}
      end)

    %{
      platform?:
        CMS.Passport.Authorization.allowed?(
          normalized,
          nil,
          CMS.GateAction.review_platform_read()
        ) == {:ok, true},
      community_slugs: community_slugs
    }
  rescue
    _ -> %{platform?: false, community_slugs: []}
  end

  def grants(_actor), do: %{platform?: false, community_slugs: []}
end
