defmodule GroupherServer.Test.CMS.MentionsDocCommentJointTest do
  @moduledoc "Doc Comment Mentions use one stable Doc parent and current edges."
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  alias GroupherServer.{CMS, Repo, Messaging}
  alias CMS.Model.Mentions.{Edge, Endpoint}
  alias CMS.Model.{CommentBody, DocBranch, DocLifecycle}
  alias CMS.Outbox.Event
  alias Messaging.Model.Mention
  alias GroupherServer.Jobs.CMSMentionNotifier

  setup do
    {community, doc, _, author} = mock_article(:doc)
    {_, target, _, _} = mock_article(:blog, community, author)
    {:ok, recipient} = db_insert(:user)

    preview =
      %DocBranch{}
      |> DocBranch.changeset(%{
        community_id: community.id,
        slug: "joint-preview",
        title: "Joint preview",
        type: :preview,
        status: :active,
        source_branch_id: doc.branch_id,
        created_by_id: author.id
      })
      |> Repo.insert!()

    {:ok,
     %{
       community: community,
       doc: doc,
       author: author,
       target: target,
       recipient: recipient,
       preview: preview
     }}
  end

  test "main and preview discussion Comments share the stable Doc parent and notify once", ctx do
    comments =
      for branch <- [ctx.doc.branch_id, ctx.preview.id] do
        {:ok, %{comment: comment}} =
          CMS.Comments.Commands.Create.create(
            :doc,
            %{id: ctx.doc.article_id, branch_id: branch, community: ctx.community},
            bag(ctx),
            ctx.author,
            Ecto.UUID.generate()
          )

        endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
        assert {:ok, :pass} = project(endpoint.id)
        assert {:ok, :pass} = project(endpoint.id)
        {comment, endpoint}
      end

    parent = Repo.get_by!(Endpoint, type: :doc, article_id: ctx.doc.article_id)

    assert Enum.all?(comments, fn {_comment, endpoint} ->
             endpoint.parent_endpoint_id == parent.id
           end)

    assert Repo.aggregate(
             from(e in Endpoint, where: e.type == :doc and e.article_id == ^ctx.doc.article_id),
             :count
           ) == 1

    assert Repo.aggregate(Mention, :count) == 2

    {comment, endpoint} = hd(comments)

    original_edges =
      Repo.all(from(edge in Edge, where: edge.source_endpoint_id == ^endpoint.id))

    assert length(original_edges) == 2
    body = Repo.get_by!(CommentBody, comment_id: comment.id)
    comment = Map.put(comment, :request_community_slug, ctx.community.slug)

    assert {:ok, _} =
             CMS.Comments.update_comment(
               comment,
               bag(ctx),
               body.version,
               ctx.author,
               Ecto.UUID.generate()
             )

    assert {:ok, :pass} = project(endpoint.id)
    assert Repo.aggregate(Mention, :count) == 2

    assert Repo.all(from(edge in Edge, where: edge.source_endpoint_id == ^endpoint.id))
           |> Enum.map(&{&1.edge_key, &1.mentioned_at})
           |> Enum.sort() ==
             original_edges |> Enum.map(&{&1.edge_key, &1.mentioned_at}) |> Enum.sort()
  end

  test "soft deleting a Doc Comment keeps its incoming and outgoing edges", ctx do
    {:ok, comment} =
      CMS.Comments.create_comment(
        ctx.community,
        :doc,
        ctx.doc.inner_id,
        bag(ctx),
        ctx.author,
        Ecto.UUID.generate()
      )

    endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)

    before_edges =
      Repo.all(from(edge in Edge, where: edge.source_endpoint_id == ^endpoint.id))

    assert length(before_edges) == 2

    comment = Map.put(comment, :request_community_slug, ctx.community.slug)
    assert {:ok, _} = CMS.Comments.delete_comment(comment, ctx.author, Ecto.UUID.generate())

    assert Repo.all(from(edge in Edge, where: edge.source_endpoint_id == ^endpoint.id))
           |> Enum.map(& &1.edge_key)
           |> Enum.sort() == Enum.map(before_edges, & &1.edge_key) |> Enum.sort()

    focus = %{type: :doc, article_inner_id: ctx.doc.inner_id}
    assert {:ok, seeds} = CMS.mentions_graph_article_comments(ctx.community.slug, focus, nil, 20)
    assert Enum.any?(seeds.comments, &(&1.comment_inner_id == comment.inner_id))

    comment_focus = %{
      type: :comment,
      article_inner_id: ctx.doc.inner_id,
      comment_inner_id: comment.inner_id
    }

    assert {:ok, page} =
             CMS.mentions_graph_page(
               ctx.community.slug,
               comment_focus,
               nil,
               20
             )

    assert Enum.any?(page.nodes, &(&1.type == :comment and &1.status == :deleted))
    assert length(page.edges) == 1
    assert Enum.any?(page.nodes, &(&1.type == :blog))

    assert {:ok, :pass} = project(endpoint.id)
    assert Repo.aggregate(Mention, :count) == 0
  end

  test "pending Comment notification waits for its parent to become readable again", ctx do
    {:ok, comment} =
      CMS.Comments.create_comment(
        ctx.community,
        :doc,
        ctx.doc.inner_id,
        bag(ctx),
        ctx.author,
        Ecto.UUID.generate()
      )

    endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
    event = Repo.get_by!(Event, event: "mention.notify", resource_id: endpoint.id)

    Repo.update_all(
      from(state in DocLifecycle,
        where: state.article_id == ^ctx.doc.article_id and state.branch_id == ^ctx.doc.branch_id
      ),
      set: [state: :deleted]
    )

    refute CMS.ArtimentMentions.Query.source_visible?(endpoint, ctx.community.id)

    doc_focus = %{type: :doc, article_inner_id: ctx.doc.inner_id}

    assert {:ok, graph} =
             CMS.mentions_graph_page(ctx.community.slug, doc_focus, nil, 20)

    assert Enum.any?(graph.nodes, &(&1.type == :doc and &1.status == :deleted))

    assert {:snooze, 3_600} = project(endpoint.id)
    assert Repo.get!(Event, event.id).status != :done
    assert Repo.aggregate(Mention, :count) == 0

    Repo.update_all(
      from(state in DocLifecycle,
        where: state.article_id == ^ctx.doc.article_id and state.branch_id == ^ctx.doc.branch_id
      ),
      set: [state: :published]
    )

    assert {:ok, :pass} = project(endpoint.id)
    assert Repo.get!(Event, event.id).status == :done
    assert Repo.aggregate(Mention, :count) == 1
    assert {:ok, :pass} = project(endpoint.id)
    assert Repo.aggregate(Mention, :count) == 1
  end

  test "a newer Comment revision carries an undelivered User mention once", ctx do
    {:ok, comment} =
      CMS.Comments.create_comment(
        ctx.community,
        :doc,
        ctx.doc.inner_id,
        bag(ctx),
        ctx.author,
        Ecto.UUID.generate()
      )

    endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
    first_event = Repo.get_by!(Event, event: "mention.notify", resource_id: endpoint.id)
    body = Repo.get_by!(CommentBody, comment_id: comment.id)
    comment = Map.put(comment, :request_community_slug, ctx.community.slug)

    assert {:ok, _} =
             CMS.Comments.update_comment(
               comment,
               bag(ctx),
               body.version,
               ctx.author,
               Ecto.UUID.generate()
             )

    events = Repo.all(from(event in Event, where: event.resource_id == ^endpoint.id))
    assert length(Enum.filter(events, &(&1.event == "mention.notify"))) == 2

    assert {:ok, :pass} =
             CMSMentionNotifier.perform(%Oban.Job{
               args: %{"event_id" => first_event.id},
               attempt: 1,
               max_attempts: 5
             })

    assert Repo.aggregate(Mention, :count) == 0
    assert {:ok, :pass} = project(endpoint.id)
    assert Repo.aggregate(Mention, :count) == 1
    assert {:ok, :pass} = project(endpoint.id)
    assert Repo.aggregate(Mention, :count) == 1
  end

  defp bag(ctx) do
    ast = [
      %{
        "type" => "p",
        "id" => "joint",
        "children" => [
          %{
            "type" => "mention",
            "key" => "blog:#{ctx.target.article_id}",
            "value" => "Target",
            "children" => [%{"text" => ""}]
          },
          %{
            "type" => "mention",
            "key" => "user:#{ctx.recipient.login}",
            "value" => "Recipient",
            "children" => [%{"text" => ""}]
          }
        ]
      }
    ]

    mock_body_bag(Jason.encode!(ast))
  end

  defp project(endpoint_id) do
    case Repo.one(
           from(event in Event,
             where: event.event == "mention.notify" and event.resource_id == ^endpoint_id,
             order_by: [desc: event.inserted_at],
             limit: 1
           )
         ) do
      nil ->
        {:ok, :pass}

      event ->
        CMSMentionNotifier.perform(%Oban.Job{
          args: %{"event_id" => event.id},
          attempt: 1,
          max_attempts: 5
        })
    end
  end
end
