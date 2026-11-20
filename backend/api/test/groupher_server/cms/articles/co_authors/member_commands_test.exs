defmodule GroupherServer.Test.CMS.Articles.CoAuthors.MemberCommandsTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.CoAuthors.Commands.{
    CancelRequest,
    CreateRequest,
    DecideRequest,
    LeaveMember,
    RemoveMember,
    UpdatePermissions
  }

  alias CMS.Articles.CoAuthors.Query

  alias CMS.Model.{
    Article,
    ArticleCoAuthor,
    ArticleCoAuthorEvent,
    ArticleCoAuthorRequest,
    ArticleWorkingCopy
  }

  @base_permissions %{"article.read_draft" => true, "article.update" => true}
  @application_permissions %{
    "article.read_draft" => true,
    "article.update" => true,
    "article.publish" => true
  }

  test "application acceptance can grant a validated subset and returns the member" do
    {_community, public, _article, owner} = mock_article(:post)
    article = load_article(public.id)
    {:ok, subject} = db_insert(:user)

    assert {:ok, request} =
             CreateRequest.execute(
               article,
               subject,
               :apply,
               @application_permissions,
               subject,
               Ecto.UUID.generate()
             )

    approved = %{"article.read_draft" => true}

    assert {:ok, {decided, %ArticleCoAuthor{} = member}} =
             DecideRequest.execute(
               article,
               request.id,
               request.revision,
               :accept,
               approved,
               owner,
               Ecto.UUID.generate()
             )

    assert decided.decision == :accept
    assert member.permissions == approved
    assert Enum.any?(article_events(article.id, subject.id), &(&1.type == :join))
  end

  test "cancel and reject enforce the request revision" do
    {_community, public, _article, owner} = mock_article(:post)
    article = load_article(public.id)
    {:ok, subject} = db_insert(:user)

    assert {:ok, cancelled_request} =
             CreateRequest.execute(
               article,
               subject,
               :invite,
               @base_permissions,
               owner,
               Ecto.UUID.generate()
             )

    assert {:error, :request_revision_conflict} =
             CancelRequest.execute(
               article,
               cancelled_request.id,
               cancelled_request.revision + 1,
               subject,
               Ecto.UUID.generate()
             )

    assert {:ok, %ArticleCoAuthorRequest{status: :cancelled}} =
             CancelRequest.execute(
               article,
               cancelled_request.id,
               cancelled_request.revision,
               subject,
               Ecto.UUID.generate()
             )

    assert {:ok, rejected_request} =
             CreateRequest.execute(
               article,
               subject,
               :invite,
               @base_permissions,
               owner,
               Ecto.UUID.generate()
             )

    assert {:ok, {%ArticleCoAuthorRequest{decision: :reject}, nil}} =
             DecideRequest.execute(
               article,
               rejected_request.id,
               rejected_request.revision,
               :reject,
               nil,
               subject,
               Ecto.UUID.generate()
             )
  end

  test "permission replacement uses Passport revision and records revoke event" do
    {_community, public, _article, owner} = mock_article(:post)
    article = load_article(public.id)
    {:ok, subject} = db_insert(:user)
    member = accept_invite(article, owner, subject)

    assert {:ok, %ArticleCoAuthor{} = updated} =
             UpdatePermissions.execute(
               article,
               member.id,
               member.revision,
               %{"article.read_draft" => true},
               owner,
               Ecto.UUID.generate()
             )

    assert updated.revision == member.revision + 1
    assert updated.permissions == %{"article.read_draft" => true}
    assert Enum.any?(article_events(article.id, subject.id), &(&1.type == :revoke))
  end

  test "removal cancels a pending application and records both transitions" do
    {_community, public, _article, owner} = mock_article(:post)
    article = load_article(public.id)
    {:ok, subject} = db_insert(:user)
    member = accept_invite(article, owner, subject)

    assert {:ok, pending} =
             CreateRequest.execute(
               article,
               subject,
               :apply,
               @application_permissions,
               subject,
               Ecto.UUID.generate()
             )

    assert {:ok, %ArticleCoAuthor{} = removed} =
             RemoveMember.execute(
               article,
               member.id,
               member.revision,
               owner,
               Ecto.UUID.generate()
             )

    refute Repo.get(ArticleCoAuthor, removed.id)
    assert Repo.get!(ArticleCoAuthorRequest, pending.id).status == :cancelled
    assert Enum.any?(article_events(article.id, subject.id), &(&1.type == :remove))
    assert Enum.any?(article_events(article.id, subject.id), &(&1.type == :request_cancel))
  end

  test "member exit deletes only the actor's membership and records exit" do
    {_community, public, _article, owner} = mock_article(:post)
    article = load_article(public.id)
    {:ok, subject} = db_insert(:user)
    member = accept_invite(article, owner, subject)

    assert {:ok, %ArticleCoAuthor{} = exited} =
             LeaveMember.execute(article, member.revision, subject, Ecto.UUID.generate())

    refute Repo.get(ArticleCoAuthor, exited.id)
    assert Enum.any?(article_events(article.id, subject.id), &(&1.type == :exit))
  end

  test "an accepted co-author can save a WorkingCopy and loses access after removal" do
    {community, public, _article, owner} = mock_article(:post)
    article = load_article(public.id)
    working_copy = Repo.get_by!(ArticleWorkingCopy, article_id: article.id, scope_type: :default)
    {:ok, subject} = db_insert(:user)
    member = accept_invite(article, owner, subject)

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               working_copy.id,
               %{title: "co-author edited title"},
               working_copy.revision,
               subject,
               Ecto.UUID.generate()
             )

    assert saved.title == "co-author edited title"
    assert saved.revision == working_copy.revision + 1

    assert {:ok, _removed} =
             RemoveMember.execute(
               article,
               member.id,
               member.revision,
               owner,
               Ecto.UUID.generate()
             )

    assert {:error, _reason} =
             CMS.Articles.save_working_copy(
               article,
               community,
               working_copy.id,
               %{title: "unauthorized overwrite"},
               saved.revision,
               subject,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, working_copy.id).title == "co-author edited title"
  end

  test "member events require a member identity while request events allow none" do
    {:ok, actor} = db_insert(:user)
    {_community, public, _article, _owner} = mock_article(:post)
    now = DateTime.utc_now(:second)

    attrs = %{
      article_id: public.id,
      subject_user_id: actor.id,
      actor_type: :user,
      actor_id: actor.id,
      type: :join,
      before_permissions: %{},
      after_permissions: %{},
      operation_ref: Ecto.UUID.generate(),
      operation_index: 0,
      occurred_at: now
    }

    invalid = ArticleCoAuthorEvent.changeset(%ArticleCoAuthorEvent{}, attrs)
    assert Keyword.has_key?(invalid.errors, :member_id)

    valid =
      ArticleCoAuthorEvent.changeset(%ArticleCoAuthorEvent{}, %{attrs | type: :request_create})

    assert valid.valid?
  end

  test "member roster is manager-only and requests are scoped to manager or subject" do
    {_community, public, _article, owner} = mock_article(:post)
    article = load_article(public.id)
    {:ok, subject} = db_insert(:user)
    {:ok, stranger} = db_insert(:user)

    assert {:ok, _request} =
             CreateRequest.execute(
               article,
               subject,
               :invite,
               @base_permissions,
               owner,
               Ecto.UUID.generate()
             )

    assert {:ok, %{entries: [_]}} = Query.requests(article, subject, nil)
    assert {:ok, %{entries: []}} = Query.requests(article, stranger, nil)
    assert {:ok, %{entries: [_]}} = Query.requests(article, owner, nil)
    assert {:error, :permission_denied} = Query.members(article, stranger, nil)
    assert {:ok, %{entries: []}} = Query.members(article, owner, nil)
  end

  defp load_article(article_id), do: Repo.get!(Article, article_id) |> Repo.preload(:author)

  defp accept_invite(article, owner, subject) do
    {:ok, request} =
      CreateRequest.execute(
        article,
        subject,
        :invite,
        @base_permissions,
        owner,
        Ecto.UUID.generate()
      )

    {:ok, {_decided, member}} =
      DecideRequest.execute(
        article,
        request.id,
        request.revision,
        :accept,
        @base_permissions,
        subject,
        Ecto.UUID.generate()
      )

    member
  end

  defp article_events(article_id, subject_id) do
    Repo.all(
      from(event in ArticleCoAuthorEvent,
        where: event.article_id == ^article_id and event.subject_user_id == ^subject_id
      )
    )
  end
end
