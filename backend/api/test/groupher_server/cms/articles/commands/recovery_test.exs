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

  test "published Article WorkingCopy writes are author-only even with a Passport grant" do
    {community, public, _attrs, author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    {:ok, other_user} = db_insert(:user)

    editor =
      Map.put(other_user, :cur_passport, %{
        "global" => %{},
        community.slug => %{"cms" => %{"post.edit" => true}}
      })

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Editor must not change Article content"},
               work.revision,
               editor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Author can change Article content"},
               work.revision,
               author,
               Ecto.UUID.generate()
             )

    assert saved.revision == work.revision + 1
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

    actor =
      Map.put(author, :cur_passport, %{
        "global" => %{"post.community.mirror" => true},
        community.slug => %{"cms" => %{"post.pin" => true}},
        destination.slug => %{"cms" => %{"post.pin" => true}}
      })

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

  test "author can save a published Article loaded without its author association" do
    {community, public, _attrs, author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()

    assert %Ecto.Association.NotLoaded{} = article.author

    assert {:ok, _} =
             CMS.Passport.stamp_passport(
               %{"global" => %{}, community.slug => %{"cms" => %{"post.pin" => false}}},
               author
             )

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

  test "Article admission uses the canonical Community rather than a forged slug" do
    {community, public, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    {:ok, other} = db_insert(:user)
    forged_slug = "forged-#{Ecto.UUID.generate()}"

    assert {:ok, _} =
             CMS.Passport.stamp_passport(
               %{"global" => %{}, forged_slug => %{"cms" => %{"post.pin" => true}}},
               other
             )

    forged_community = %{community | slug: forged_slug}

    assert {:error, %CMS.Gate.Decision{allowed: false}} =
             CMS.Gate.Access.Check.article(other, :edit, article, forged_community)
  end

  test "a Passport editor cannot save a published Article WorkingCopy" do
    {community, public, _attrs, _author} = mock_article(:post)
    article = Repo.get!(Article, public.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    {:ok, editor} = db_insert(:user)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Private draft"}

    assert {:ok, _} =
             CMS.Passport.stamp_passport(
               %{"global" => %{}, community.slug => %{"cms" => %{"post.pin" => true}}},
               editor
             )

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
             CMS.Passport.stamp_passport(
               %{"global" => %{}, community.slug => %{"cms" => %{"post.pin" => false}}},
               editor
             )

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
             CMS.Passport.stamp_passport(
               %{"global" => %{}, community.slug => %{"cms" => %{"post.pin" => true}}},
               editor
             )

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
             CMS.Passport.stamp_passport(
               %{"global" => %{}, community.slug => %{"cms" => %{"post.pin" => false}}},
               editor
             )

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
