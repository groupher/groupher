defmodule GroupherServer.CMS.Communities.Subscriptions.Persist do
  @moduledoc """
  Caller-owned persistence primitives for Community subscriptions.

  These functions only write the membership row.  The Command or Setup owner
  supplies the transaction, Gate admission, denormalized counters and profile
  projection updates.

      Command/Setup owner -> Persist row primitive -> caller-owned projections
  """

  import ShortMaps

  alias GroupherServer.CMS.Model.{Community, CommunitySubscriber}
  alias Helper.{ORM, T}
  alias GroupherServer.Accounts.Model.User

  @doc "Creates a subscription if it does not already exist."
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(CommunitySubscriber.t())
  def subscribe(%Community{id: community_id}, %User{id: user_id}) do
    CommunitySubscriber
    |> ORM.insert_or_ignore(~m(community_id user_id)a,
      conflict_target: [:user_id, :community_id]
    )
  end

  @doc "Deletes a subscription if it exists."
  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(CommunitySubscriber.t() | atom())
  def unsubscribe(%Community{id: community_id}, %User{id: user_id}) do
    CommunitySubscriber |> ORM.findby_delete(~m(community_id user_id)a)
  end

  @doc "Checks membership without mutating state."
  @spec subscribed?(Community.t(), User.t()) :: boolean()
  def subscribed?(%Community{id: community_id}, %User{id: user_id}) do
    match?({:ok, _}, ORM.find_by(CommunitySubscriber, ~m(community_id user_id)a))
  end
end
