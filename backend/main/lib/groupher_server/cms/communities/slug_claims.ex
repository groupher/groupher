defmodule GroupherServer.CMS.Communities.SlugClaims do
  @moduledoc """
  Database-backed ownership for the shared community slug namespace.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> SlugClaims
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias GroupherServer.CMS.Model.{CommunityApplication, CommunitySlugClaim}
  alias GroupherServer.Repo

  @spec insert_application(Multi.t(), atom(), atom(), DateTime.t()) :: Multi.t()
  def insert_application(multi, name, application_key, expires_at) do
    Multi.insert(multi, name, fn changes ->
      application = Map.fetch!(changes, application_key)

      CommunitySlugClaim.changeset(%CommunitySlugClaim{}, %{
        slug: application.slug,
        status: :application,
        application_id: application.id,
        claimed_by_user_id: application.user_id,
        claim_reason: "community_application",
        expires_at: expires_at
      })
    end)
  end

  @spec release_application(Multi.t(), atom(), CommunityApplication.t(), DateTime.t()) ::
          Multi.t()
  def release_application(multi, name, %CommunityApplication{} = application, now) do
    Multi.update_all(
      multi,
      name,
      from(claim in CommunitySlugClaim,
        where: claim.application_id == ^application.id and is_nil(claim.released_at)
      ),
      set: [released_at: now, expires_at: nil, updated_at: now]
    )
  end

  @spec clear_expiry(Multi.t(), atom(), CommunityApplication.t(), DateTime.t()) :: Multi.t()
  def clear_expiry(multi, name, %CommunityApplication{} = application, now) do
    Multi.update_all(
      multi,
      name,
      from(claim in CommunitySlugClaim,
        where: claim.application_id == ^application.id and is_nil(claim.released_at)
      ),
      set: [expires_at: nil, updated_at: now]
    )
  end

  @spec promote(Multi.t(), atom(), CommunityApplication.t(), atom(), DateTime.t()) :: Multi.t()
  def promote(multi, name, %CommunityApplication{} = application, community_key, now) do
    Multi.update_all(
      multi,
      name,
      fn changes ->
        community = Map.fetch!(changes, community_key)

        from(claim in CommunitySlugClaim,
          where: claim.application_id == ^application.id and is_nil(claim.released_at),
          update: [
            set: [
              status: :community,
              community_id: ^community.id,
              expires_at: nil,
              updated_at: ^now
            ]
          ]
        )
      end,
      []
    )
  end

  @spec claim_for_application(CommunityApplication.t()) :: CommunitySlugClaim.t() | nil
  def claim_for_application(%CommunityApplication{id: application_id}) do
    Repo.one(
      from(claim in CommunitySlugClaim,
        where: claim.application_id == ^application_id and is_nil(claim.released_at)
      )
    )
  end

  @spec release_expired(DateTime.t()) :: {non_neg_integer(), nil}
  def release_expired(%DateTime{} = now) do
    terminal_statuses = ~w(created rejected cancelled expired creation_failed)a

    from(claim in CommunitySlugClaim,
      join: application in CommunityApplication,
      on: application.id == claim.application_id,
      where:
        claim.status == :application and is_nil(claim.released_at) and
          application.status in ^terminal_statuses and
          (is_nil(claim.expires_at) or claim.expires_at <= ^now)
    )
    |> Repo.update_all(set: [released_at: now, expires_at: nil, updated_at: now])
  end

end
