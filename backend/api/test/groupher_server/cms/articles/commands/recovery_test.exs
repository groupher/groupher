defmodule GroupherServer.Test.CMS.Articles.Commands.Recovery do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleLifecycle,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    CommunityDashboard
  }

  test "Blog and Changelog use their own published editing settings" do
    for {thread, setting} <- [
          {:blog, :blog_published_editing},
          {:changelog, :changelog_published_editing}
        ] do
      {community, public, _attrs, user} = mock_article(thread)
      article = Repo.get!(Article, public.id)
      work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)

      assert {:ok, _} =
               CMS.Dashboard.update(
                 community,
                 :enable,
                 %{setting => false},
                 :operations,
                 Ecto.UUID.generate()
               )

      assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
               CMS.Articles.save_working_copy(
                 article,
                 community,
                 work.id,
                 %{title: "Blocked"},
                 work.revision,
                 user,
                 Ecto.UUID.generate()
               )

      assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
    end
  end

  test "a Post coauthor with Article update permission can save the WorkingCopy" do
    {community, public, _attrs, author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    {:ok, other_user} = db_insert(:user)

    editor_author = Repo.insert!(%CMS.Model.Author{user_id: other_user.id})

    Repo.insert!(
      CMS.Model.ArticleCoAuthor.changeset(%CMS.Model.ArticleCoAuthor{}, %{
        article_id: article.id,
        author_id: editor_author.id,
        joined_at: DateTime.utc_now(:second),
        permissions: %{"article.read_draft" => true, "article.update" => true}
      })
    )

    assert {:ok, coauthor_saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Coauthor updated content"},
               work.revision,
               other_user,
               Ecto.UUID.generate()
             )

    assert coauthor_saved.revision == work.revision + 1

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Author can change Article content"},
               coauthor_saved.revision,
               author,
               Ecto.UUID.generate()
             )

    assert saved.revision == work.revision + 2
  end

  test "a missing required Dashboard fails published editing closed" do
    {community, public, _attrs, author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    Repo.delete!(Repo.get_by!(CommunityDashboard, community_id: community.id))

    assert {:error, %ErrorCat.Error{reason: :dashboard_not_found}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Dashboard invariant failure"},
               work.revision,
               author,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
  end

  test "a nonauthor gets permission denied before a missing Dashboard invariant error" do
    {community, public, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    Repo.delete!(Repo.get_by!(CommunityDashboard, community_id: community.id))
    {:ok, other_user} = db_insert(:user)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Do not disclose Dashboard invariant"},
               work.revision,
               other_user,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
  end

  test "platform default applies only after an Article has a Public selection" do
    previous = Application.fetch_env(:groupher_server, :published_article_editing_default)
    Application.put_env(:groupher_server, :published_article_editing_default, false)

    on_exit(fn ->
      case previous do
        {:ok, value} ->
          Application.put_env(:groupher_server, :published_article_editing_default, value)

        :error ->
          Application.delete_env(:groupher_server, :published_article_editing_default)
      end
    end)

    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)

    assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Blocked"},
               work.revision,
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Dashboard.update(
               community,
               :enable,
               %{post_published_editing: true},
               :operations,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Override allows editing"},
               work.revision,
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Dashboard.update(
               community,
               :enable,
               %{post_published_editing: nil},
               :operations,
               Ecto.UUID.generate()
             )

    attrs = %{title: "Unpublished", body_bag: mock_body_bag(mock_rich_text("draft"))}

    assert {:ok, %{article: draft, working_copy: draft_work}} =
             CMS.Articles.create_article(community, :post, attrs, user,
               command_id: Ecto.UUID.generate()
             )

    refute Repo.get(ArticlePublic, draft.id)

    assert {:ok, %ArticleSnapshot{article_id: draft_id}} =
             Repo.transact(fn ->
               CMS.Articles.WorkingCopy.Snapshotter.freeze_in_transaction(
                 draft_work.id,
                 draft_work.revision,
                 user,
                 Ecto.UUID.generate()
               )
             end)

    assert draft_id == draft.id

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               draft,
               community,
               draft_work.id,
               %{title: "Draft edit"},
               draft_work.revision,
               user,
               Ecto.UUID.generate()
             )

    assert saved.title == "Draft edit"
  end

  test "any binding can disable editing across all Communities" do
    {community, public, _attrs, author} = mock_article(:post)
    {:ok, destination} = mock_community(author)

    for site <- [community, destination] do
      {:ok, _} =
        GroupherServer.Test.PassportFixture.grant_community(author, site.slug, %{
          "article.mirror" => true,
          "post.pin" => true
        })
    end

    actor = author

    assert {:ok, _} =
             CMS.Articles.mirror(
               destination,
               public.id,
               [],
               actor,
               community,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Dashboard.update(
               community,
               :enable,
               %{post_published_editing: true},
               :operations,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Dashboard.update(
               destination,
               :enable,
               %{post_published_editing: false},
               :operations,
               Ecto.UUID.generate()
             )

    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)

    assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Blocked"},
               work.revision,
               author,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
  end

  test "published editing policy denies new writes but permits a confirmed receipt replay" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Before policy change"}
    snapshot_id = Repo.get!(ArticlePublic, article.id).snapshot_id
    fork_id = Ecto.UUID.generate()
    fork_scope = Ecto.UUID.generate()

    assert {:ok, %{working_copy: forked}} =
             CMS.Articles.fork_snapshot(
               snapshot_id,
               community,
               :workspace,
               fork_scope,
               user,
               fork_id
             )

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    assert {:ok, dashboard} =
             CMS.Dashboard.update(
               community,
               :enable,
               %{post_published_editing: false},
               :operations,
               Ecto.UUID.generate()
             )

    assert dashboard.enable.post_published_editing == false

    {:ok, other} = db_insert(:user)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Unauthorized"},
               saved.revision,
               other,
               Ecto.UUID.generate()
             )

    assert {:ok, replayed} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    assert replayed.revision == saved.revision

    assert {:ok, %{working_copy: replayed_fork}} =
             CMS.Articles.fork_snapshot(
               snapshot_id,
               community,
               :workspace,
               fork_scope,
               user,
               fork_id
             )

    assert replayed_fork.id == forked.id

    assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Blocked"},
               saved.revision,
               user,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, work.id).title == "Before policy change"

    assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
             CMS.Articles.fork_snapshot(
               snapshot_id,
               community,
               :workspace,
               Ecto.UUID.generate(),
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               forked.id,
               user,
               Ecto.UUID.generate()
             )

    refute Repo.get(ArticleWorkingCopy, forked.id)

    assert {:ok, dashboard} =
             CMS.Dashboard.update(
               community,
               :enable,
               %{post_published_editing: nil},
               :operations,
               Ecto.UUID.generate()
             )

    assert is_nil(dashboard.enable.post_published_editing)

    assert {:ok, _} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Enabled again"},
               saved.revision,
               user,
               Ecto.UUID.generate()
             )
  end

  test "createArticle replay returns its original default WorkingCopy" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    command_id = Ecto.UUID.generate()

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "Draft Article", body_bag: mock_body_bag(mock_rich_text("draft"))},
               user,
               command_id: command_id
             )

    assert {:ok, %{article: replayed_article, working_copy: replayed_work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "Draft Article", body_bag: mock_body_bag(mock_rich_text("draft"))},
               user,
               command_id: command_id
             )

    assert replayed_article.id == article.id
    assert replayed_work.id == work.id
    assert replayed_work.revision == 1
  end

  test "createArticle replay does not expose a copy after its Article is deleted" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Private draft", body_bag: mock_body_bag(mock_rich_text("draft"))}

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(community, :post, attrs, user, command_id: command_id)

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)
    now = DateTime.utc_now(:second)

    assert {:ok, _} =
             lifecycle
             |> ArticleLifecycle.changeset(%{state: :deleted, deleted_at: now, changed_at: now})
             |> Repo.update()

    assert {:error, %ErrorCat.Error{reason: :command_result_unavailable}} =
             CMS.Articles.create_article(community, :post, attrs, user, command_id: command_id)

    assert Repo.get!(ArticleWorkingCopy, work.id).article_id == article.id
  end

  test "forkSnapshot replay maps a newly denied result to command_result_unavailable" do
    {community, public, _attrs, author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    snapshot_id = Repo.get!(ArticlePublic, article.id).snapshot_id
    command_id = Ecto.UUID.generate()
    scope_id = Ecto.UUID.generate()

    assert {:ok, %{working_copy: _work}} =
             CMS.Articles.fork_snapshot(
               snapshot_id,
               community,
               :workspace,
               scope_id,
               author,
               command_id
             )

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)
    now = DateTime.utc_now(:second)

    assert {:ok, _} =
             lifecycle
             |> ArticleLifecycle.changeset(%{
               state: :archived,
               archived_at: now,
               changed_at: now,
               version: lifecycle.version + 1
             })
             |> Repo.update()

    assert {:error, error} =
             CMS.Articles.fork_snapshot(
               snapshot_id,
               community,
               :workspace,
               scope_id,
               author,
               command_id
             )

    assert CMS.ErrorCat.code(error) == 4534
  end

  test "createAndPublishArticle retry returns its original Snapshot" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Published Article", body_bag: mock_body_bag(mock_rich_text("body"))}

    assert {:ok, %{article: article, snapshot: snapshot}} =
             CMS.Articles.create_and_publish_article(
               community,
               :post,
               attrs,
               user,
               command_id: command_id
             )

    assert {:ok, %{article: replayed_article, snapshot: replayed_snapshot}} =
             CMS.Articles.create_and_publish_article(
               community,
               :post,
               attrs,
               user,
               command_id: command_id
             )

    assert replayed_article.id == article.id
    assert replayed_snapshot.id == snapshot.id
    assert Repo.get!(ArticlePublic, article.id).snapshot_id == snapshot.id
  end

  test "saveWorkingCopy retries preserve the confirmed revision" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Saved title"},
               work.revision,
               user,
               command_id
             )

    assert {:ok, replayed} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Saved title"},
               work.revision,
               user,
               command_id
             )

    assert replayed.id == saved.id
    assert replayed.revision == saved.revision
    assert replayed.title == "Saved title"
  end

  test "saveWorkingCopy replay remains readable after published editing is disabled" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Saved before editing was disabled"}

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    assert {:ok, _} =
             CMS.Dashboard.update(
               community,
               :enable,
               %{post_published_editing: false},
               :operations,
               Ecto.UUID.generate()
             )

    assert {:ok, replayed} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    assert replayed.id == saved.id
    assert replayed.revision == saved.revision

    assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "New write"},
               saved.revision,
               user,
               Ecto.UUID.generate()
             )
  end

  test "saveWorkingCopy replay does not disclose a deleted Article's working copy" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Saved before deletion"}

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    lifecycle = Repo.get_by!(ArticleLifecycle, article_id: article.id)
    now = DateTime.utc_now(:second)

    lifecycle
    |> ArticleLifecycle.changeset(%{
      state: :deleted,
      deleted_at: now,
      changed_at: now,
      version: lifecycle.version + 1
    })
    |> Repo.update!()

    assert {:error, %ErrorCat.Error{reason: :command_result_unavailable}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == saved.revision
  end

  test "saveWorkingCopy replay cannot present a later revision as the original result" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "First save"}

    assert {:ok, first} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    assert {:ok, second} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Second save"},
               first.revision,
               user,
               Ecto.UUID.generate()
             )

    assert {:error, %ErrorCat.Error{reason: :command_result_unavailable}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    current = Repo.get!(ArticleWorkingCopy, work.id)
    assert current.revision == second.revision
    assert current.title == "Second save"
  end

  test "saveWorkingCopy rejects the same command identity with different input" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Original"},
               work.revision,
               user,
               command_id
             )

    assert {:error, %ErrorCat.Error{reason: :command_id_conflict}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Different"},
               work.revision,
               user,
               command_id
             )

    current = Repo.get!(ArticleWorkingCopy, work.id)
    assert current.revision == saved.revision
    assert current.title == "Original"
  end

  test "saveWorkingCopy does not execute again after its receipt result expires" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Saved before expiry"}

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    receipt = Repo.get_by!(CMS.Model.CommandReceipt, command_id: command_id)

    receipt
    |> Ecto.Changeset.change(expires_at: DateTime.add(DateTime.utc_now(:second), -60, :second))
    |> Repo.update!()

    assert {:error, %ErrorCat.Error{reason: :command_result_expired}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               user,
               command_id
             )

    current = Repo.get!(ArticleWorkingCopy, work.id)
    assert current.revision == saved.revision
    assert current.title == "Saved before expiry"
  end

  test "author can save a published Article loaded without its author association" do
    {community, public, _attrs, author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()

    assert %Ecto.Association.NotLoaded{} = article.author

    assert {:ok, _} =
             GroupherServer.Test.PassportFixture.grant_community(author, community.slug, %{
               "post.pin" => false
             })

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Author edit"},
               work.revision,
               author,
               command_id
             )

    assert saved.title == "Author edit"
    assert saved.revision == work.revision + 1

    assert {:ok, replayed} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Author edit"},
               work.revision,
               author,
               command_id
             )

    assert replayed.id == saved.id
    assert replayed.revision == saved.revision
  end

  test "independent Article admission ignores a forged caller-side author" do
    {community, public, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    {:ok, other} = db_insert(:user)
    forged = %{article | author: %CMS.Model.Author{user_id: other.id}}

    assert {:error, %CMS.Gate.Decision{allowed: false}} =
             CMS.Gate.Access.Check.article(other, :edit, forged, community)
  end

  test "independent Article admission rejects a caller-side thread mismatch" do
    {community, public, _attrs, author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    forged = %{article | thread: :blog}

    assert {:error,
            %CMS.Gate.Decision{allowed: false, primary: %{reason: :gate_resource_mismatch}}} =
             CMS.Gate.Access.Check.article(author, :edit, forged, community)
  end

  test "Community admission uses the canonical Community rather than a forged slug" do
    {community, _public, _attrs, _author} = mock_article(:post)
    {:ok, other} = db_insert(:user)
    {:ok, other_community} = mock_community(other)
    forged_slug = other_community.slug

    forged_community = %{community | slug: forged_slug}

    assert {:error, %CMS.Gate.Decision{allowed: false, primary: %{reason: :permission_denied}}} =
             CMS.Gate.Access.Check.community(other, :update, forged_community)
  end

  test "a Passport editor cannot save a published Article WorkingCopy" do
    {community, public, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    {:ok, editor} = db_insert(:user)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Private draft"}

    assert {:ok, _} =
             GroupherServer.Test.PassportFixture.grant_community(editor, community.slug, %{
               "post.pin" => true
             })

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               editor,
               command_id
             )

    assert {:ok, _} =
             GroupherServer.Test.PassportFixture.grant_community(editor, community.slug, %{
               "post.pin" => false
             })

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               attrs,
               work.revision,
               editor,
               command_id
             )

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision
    refute Repo.get!(ArticleWorkingCopy, work.id).title == "Private draft"
  end

  test "a Passport editor cannot fork a Snapshot into a WorkingCopy" do
    {community, public, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    snapshot_id = Repo.get!(ArticlePublic, article.id).snapshot_id
    {:ok, editor} = db_insert(:user)
    command_id = Ecto.UUID.generate()
    scope_id = Ecto.UUID.generate()

    assert {:ok, _} =
             GroupherServer.Test.PassportFixture.grant_community(editor, community.slug, %{
               "post.pin" => true
             })

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CMS.Articles.fork_snapshot(
               snapshot_id,
               community,
               :workspace,
               scope_id,
               editor,
               command_id
             )

    assert {:ok, _} =
             GroupherServer.Test.PassportFixture.grant_community(editor, community.slug, %{
               "post.pin" => false
             })

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CMS.Articles.fork_snapshot(
               snapshot_id,
               community,
               :workspace,
               scope_id,
               editor,
               command_id
             )

    refute Repo.get_by(ArticleWorkingCopy,
             article_id: article.id,
             scope_type: :workspace,
             scope_id: scope_id
           )
  end

  test "publishArticle retries return the selected Snapshot" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    current = Repo.get!(ArticlePublic, article.id)
    command_id = Ecto.UUID.generate()
    source = %{working_copy_id: work.id, revision: work.revision}

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      user,
      minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
    )

    assert {:ok, %{snapshot: snapshot}} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               current.snapshot_id,
               user,
               command_id
             )

    assert {:ok, %{snapshot: replayed_snapshot}} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               current.snapshot_id,
               user,
               command_id
             )

    assert replayed_snapshot.id == snapshot.id
    assert Repo.get!(ArticleSnapshot, snapshot.id).title == snapshot.title
  end
end
