defmodule GroupherServer.Test.CMS.Gate.Scope.TicketTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Gate.Context.Scope.Ticket, as: TicketContext
  alias CMS.Model.{CommunityAdmin, TicketState}

  test "internal Ticket scope enforces current grants and keeps the Community boundary" do
    {community, post, _attrs, editor} = mock_article(:post)
    {:ok, other_community_owner} = db_insert(:user)
    {:ok, other_community} = mock_community(other_community_owner)
    {:ok, reader} = db_insert(:user)

    editor_admin = Repo.get_by!(CommunityAdmin, user_id: editor.id, community_id: community.id)

    Repo.update!(
      CommunityAdmin.changeset(editor_admin, %{
        permissions:
          Map.merge(editor_admin.permissions, %{
            "ticket.create" => true,
            "ticket.read_internal" => true
          })
      })
    )

    Repo.insert!(
      CommunityAdmin.changeset(%CommunityAdmin{}, %{
        user_id: reader.id,
        community_id: community.id,
        permissions: %{
          "ticket.create" => true,
          "ticket.read_internal" => true
        }
      })
    )

    {:ok, ticket} =
      CMS.Tickets.create_from_post(
        community,
        post.id,
        %{title: "Internal scope", digest: "Ticket"},
        editor,
        Ecto.UUID.generate()
      )

    context = TicketContext.internal(community)
    ticket_id = ticket.id

    assert {:ok, query} = CMS.Gate.scope(TicketState, reader, :read, context)
    assert [%TicketState{article_id: ^ticket_id}] = Repo.all(query)

    assert {:ok, other_community_query} =
             CMS.Gate.scope(TicketState, reader, :read, TicketContext.internal(other_community))

    assert Repo.all(other_community_query) == []

    assert {:ok, mismatched_slug_query} =
             CMS.Gate.scope(
               TicketState,
               reader,
               :read,
               %{context | community_slug: other_community.slug}
             )

    assert Repo.all(mismatched_slug_query) == []

    member = Repo.get_by!(CommunityAdmin, user_id: reader.id, community_id: community.id)
    Repo.update!(CommunityAdmin.changeset(member, %{permissions: %{}}))

    assert {:ok, revoked_query} = CMS.Gate.scope(TicketState, reader, :read, context)
    assert Repo.all(revoked_query) == []
  end
end
