defmodule GroupherServer.TestWeb.Schema.ArticleCoAuthorExecutionTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServerWeb.Schema

  @permissions %{"article.read_draft" => true, "article.update" => true}

  test "invite, subject read, accept, and privacy boundaries work through Absinthe" do
    {_community, public, _article, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    {:ok, stranger} = db_insert(:user)
    article_id = public.id

    invite = """
    mutation Invite($articleId: ID!, $subjectLogin: String!, $permissions: Json!, $commandId: ID!) {
      createArticleCoAuthorRequest(
        articleId: $articleId,
        subjectLogin: $subjectLogin,
        type: INVITE,
        permissions: $permissions,
        commandId: $commandId
      ) { id status revision type }
    }
    """

    assert {:ok, %{data: %{"createArticleCoAuthorRequest" => invite_result}}} =
             run(invite, owner, %{
               "articleId" => article_id,
               "subjectLogin" => subject.login,
               "permissions" => Jason.encode!(@permissions),
               "commandId" => Ecto.UUID.generate()
             })

    request_id = invite_result["id"]
    assert invite_result["status"] == "PENDING"

    request_query = """
    query Requests($articleId: ID!) {
      pagedArticleCoAuthorRequests(articleId: $articleId) {
        entries { id status revision }
      }
    }
    """

    assert {:ok, %{data: %{"pagedArticleCoAuthorRequests" => %{"entries" => [subject_request]}}}} =
             run(request_query, subject, %{"articleId" => article_id})

    assert subject_request["id"] == request_id

    assert {:ok, %{data: %{"pagedArticleCoAuthorRequests" => %{"entries" => []}}}} =
             run(request_query, stranger, %{"articleId" => article_id})

    decide = """
    mutation Accept($requestId: ID!, $revision: Int!, $commandId: ID!) {
      decideArticleCoAuthorRequest(
        requestId: $requestId,
        revision: $revision,
        decision: ACCEPT,
        commandId: $commandId
      ) {
        id status decision revision
        currentMember { memberId revision user { login } }
      }
    }
    """

    assert {:ok, %{data: %{"decideArticleCoAuthorRequest" => decision_result}}} =
             run(decide, subject, %{
               "requestId" => request_id,
               "revision" => subject_request["revision"],
               "commandId" => Ecto.UUID.generate()
             })

    assert decision_result["status"] == "DECIDED"
    assert decision_result["decision"] == "ACCEPT"
    assert decision_result["currentMember"]["memberId"]
    assert decision_result["currentMember"]["revision"] == 1
    assert decision_result["currentMember"]["user"]["login"] == subject.login

    member_query = """
    query Members($articleId: ID!) {
      pagedArticleCoAuthors(articleId: $articleId) { entries { memberId revision user { login } } }
    }
    """

    assert {:ok, %{data: %{"pagedArticleCoAuthors" => %{"entries" => [owner_entry]}}}} =
             run(member_query, owner, %{"articleId" => article_id})

    assert owner_entry["user"]["login"] == subject.login

    assert {:ok, %{errors: [_ | _]}} = run(member_query, subject, %{"articleId" => article_id})
    assert {:ok, %{errors: [_ | _]}} = run(member_query, stranger, %{"articleId" => article_id})

    permissions_query = """
    query MyPermissions($articleId: ID!) {
      articlePermissions(articleId: $articleId) { articleId isOwner permissions }
    }
    """

    assert {:ok, %{data: %{"articlePermissions" => viewer_permissions}}} =
             run(permissions_query, subject, %{"articleId" => article_id})

    assert viewer_permissions["isOwner"] == false
    assert is_list(viewer_permissions["permissions"])
  end

  defp run(document, actor, variables) do
    Absinthe.run(document, Schema, variables: variables, context: %{cur_user: actor})
  end
end
