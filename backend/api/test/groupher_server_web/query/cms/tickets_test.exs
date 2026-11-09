defmodule GroupherServer.Test.Query.CMS.Tickets do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  setup do
    {community, post, _attrs, user} = mock_article(:post)

    grants = %{
      "ticket.create" => true,
      "ticket.manage_visibility" => true,
      "ticket.read_internal" => true
    }

    actor = %{
      user
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => grants}
        }
    }

    {:ok, ticket} =
      CMS.Tickets.create_from_post(
        community,
        post.id,
        %{title: "GraphQL Ticket", digest: "Public summary"},
        actor,
        Ecto.UUID.generate()
      )

    {:ok, draft} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:ok, _ticket_id} =
             CMS.Tickets.publish(
               community,
               ticket.id,
               "Reviewed for public release",
               draft.draft_version,
               draft.lifecycle_version,
               draft.workflow_version,
               actor,
               Ecto.UUID.generate(),
               CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
             )

    {:ok, published_ticket} = CMS.Tickets.get_internal(community, ticket.id, actor)
    assert is_integer(published_ticket.inner_id)

    guest_conn = simu_conn(:guest)

    internal_conn =
      simu_conn(:user, actor, cms: %{community.slug => grants})

    {:ok, ~m(community post published_ticket actor guest_conn internal_conn)a}
  end

  test "anonymous Post progress query executes through the real Ticket Gate", context do
    result =
      gq_query(context.guest_conn, S.Ticket.q(:post_progress), %{
        community: context.community.slug,
        ids: [context.post.inner_id]
      })

    assert [%{"status" => "TODO", "total" => 1, "completed" => 0}] = result
  end

  test "public Ticket query returns only published content and typed sources", context do
    %{community: community, published_ticket: ticket, guest_conn: guest_conn} = context

    result =
      guest_conn
      |> gq_query(S.Ticket.q(:ticket), %{
        community: community.slug,
        innerId: ticket.inner_id
      })

    assert result["id"] == to_string(ticket.inner_id)
    assert result["innerId"] == ticket.inner_id
    assert result["type"] == "USER"
    assert result["publicationState"] == "PUBLISHED"
    assert result["title"] == "GraphQL Ticket"
    assert result["digest"] == "Public summary"
    assert is_nil(result["draftContent"])
    assert result["publishedContent"]["title"] == "GraphQL Ticket"
    assert is_nil(result["hasUnpublishedChanges"])
    assert is_nil(result["publicationPreview"])

    assert [%{"type" => "POST", "innerId" => post_inner_id, "title" => post_title}] =
             result["sources"]

    assert is_integer(post_inner_id)
    assert is_binary(post_title)
  end

  test "Ticket internal query requires internal read permission and exposes versions", context do
    %{
      community: community,
      published_ticket: ticket,
      guest_conn: guest_conn,
      internal_conn: internal_conn
    } = context

    variables = %{community: community.slug, id: ticket.id}
    query = S.Ticket.q(:ticket_internal)

    assert guest_conn |> query_error?(query, variables)

    result = internal_conn |> gq_query(query, variables)

    assert result["id"] == ticket.id
    assert result["publicationState"] == "PUBLISHED"
    assert is_nil(result["draftVersion"])
    assert is_integer(result["lifecycleVersion"])
    assert is_integer(result["workflowVersion"])
    assert byte_size(result["publicationPreview"]) == 64
    assert is_nil(result["draftContent"])
    assert result["publishedContent"]["digest"] == "Public summary"
  end
end
