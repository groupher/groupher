# Load fixture helpers only into this test VM; production compilation excludes dev/.
for file <- [
      "seed/run.ex",
      "seed/target.ex",
      "local_test_actors.ex",
      "local_test_actors/communities.ex",
      "seed/article/create.ex",
      "local_test_actors/grants.ex",
      "seed/cleanup/run.ex",
      "seed/admin/invite.ex",
      "seed/admin/accept.ex",
      "seed/admin/membership.ex",
      "seed/admin/set_permissions.ex",
      "seed/admin/remove.ex",
      "seed/community/create.ex",
      "seed/community/request_destroy.ex",
      "seed/home/prepare.ex",
      "seed/actor/create.ex",
      "seed/scenario/theme_permissions.ex"
    ] do
  Code.require_file("../../dev/" <> file, __DIR__)
end

defmodule GroupherServer.LocalTestActorsGrantsTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{Accounts, CMS, Repo, LocalTestActors}
  alias Accounts.Model.OauthProvider
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorEvent, ArticleCoAuthorRequest, Author}
  alias LocalTestActors.Grants

  @permissions %{"article.read_draft" => true, "article.update" => true}

  test "seed and GraphQL share the verb-first Context entrypoints" do
    for {current, previous, arities} <- [
          {:create_community, :communities_create, [2, 3]},
          {:request_community_destruction, :communities_request_destroy, [1, 2, 3]},
          {:create_community_admin_request, :communities_admins_create, [6]},
          {:decide_community_admin_request, :communities_admins_decide, [6]},
          {:cancel_community_admin_request, :communities_admins_cancel, [4]},
          {:update_community_admin_permissions, :communities_admins_update_permissions, [6]},
          {:remove_community_admin, :communities_admins_remove, [5]},
          {:cancel_article_co_author_request, :articles_co_authors_cancel_request, [4]},
          {:leave_article_co_author_role, :articles_co_authors_leave_member, [4]},
          {:search_community_admin_candidates, :communities_admins_candidates, [3]},
          {:page_community_admins, :communities_admins_page, [3]},
          {:page_community_admin_memberships, :communities_admins_members, [4]},
          {:page_community_admin_requests, :communities_admins_requests, [3]},
          {:leave_community_admin_role, :communities_admins_leave, [4]},
          {:get_current_community_admin_membership, :communities_admins_current, [2]},
          {:check_community_admin_management_access, :communities_admins_management_allowed, [2]},
          {:search_article_co_author_candidates, :articles_co_authors_candidates, [3]},
          {:page_article_co_authors, :articles_co_authors_members, [3]},
          {:page_article_co_author_requests, :articles_co_authors_requests, [3]},
          {:get_current_article_co_author_permissions, :articles_co_authors_permissions, [2]},
          {:create_article_co_author_request, :articles_co_authors_create_request, [6]},
          {:decide_article_co_author_request, :articles_co_authors_decide_request, [6]},
          {:update_article_co_author_permissions, :articles_co_authors_update_permissions, [6]},
          {:remove_article_co_author, :articles_co_authors_remove_member, [5]},
          {:reject_co_author_working_copy_access, :articles_co_authors_reject_working_copy_access,
           [2]}
        ],
        arity <- arities do
      assert function_exported?(CMS, current, arity)
      refute function_exported?(CMS, previous, arity)
    end
  end

  test "community, category and tag facade names use the shared vocabulary" do
    exports = CMS.__info__(:functions)

    for {current, previous} <- [
          {:update_community, :communities_update},
          {:fetch_community, :communities_fetch},
          {:page_communities, :communities_paged},
          {:list_community_categories, :communities_categories},
          {:check_community_slug_availability, :communities_check_name},
          {:create_community_category, :communities_create_category},
          {:update_community_category, :communities_update_category},
          {:delete_community_category, :communities_delete_category},
          {:assign_community_category, :communities_set_category},
          {:unassign_community_category, :communities_unset_category},
          {:create_community_tag, :communities_create_tag},
          {:update_community_tag, :communities_update_tag},
          {:delete_community_tag, :communities_delete_tag},
          {:tag_article, :communities_set_tag},
          {:untag_article, :communities_unset_tag},
          {:create_community_tag_group, :communities_create_tag_group},
          {:update_community_tag_group, :communities_update_tag_group},
          {:delete_community_tag_group, :communities_delete_tag_group},
          {:list_community_tag_groups, :communities_tag_groups},
          {:get_community_tag_stats, :communities_tag_stats},
          {:reindex_community_tag_groups, :communities_reindex_tag_groups},
          {:reindex_tags_in_group, :communities_reindex_tags_in_group},
          {:reindex_tags_across_groups, :communities_reindex_tags_across_groups},
          {:subscribe_to_community, :communities_subscribe},
          {:unsubscribe_from_community, :communities_unsubscribe}
        ] do
      assert Enum.any?(exports, fn {name, _arity} -> name == current end)
      refute Enum.any?(exports, fn {name, _arity} -> name == previous end)
    end
  end

  test "article, theme and asset facade names use the shared vocabulary" do
    exports = CMS.__info__(:functions)

    for {current, previous} <- [
          {:create_article, :articles_create_article},
          {:create_and_publish_article, :articles_create_and_publish_article},
          {:publish_article, :articles_publish_article},
          {:save_article_working_copy, :articles_save_working_copy},
          {:delete_article_working_copy, :articles_delete_working_copy},
          {:fork_article_snapshot, :articles_fork_snapshot},
          {:save_custom_theme_preset, :dashboard_save_custom_theme_preset},
          {:select_theme_preset, :dashboard_select_theme_preset},
          {:page_community_assets, :assets_page},
          {:page_asset_references, :assets_refs},
          {:register_community_asset, :assets_register_to_community},
          {:create_community_asset_upload_intent, :assets_create_upload_intent},
          {:complete_asset_upload, :assets_complete_upload},
          {:delete_community_asset, :assets_delete},
          {:prepare_wallpaper_upload, :wallpaper_prepare_upload},
          {:publish_wallpaper, :wallpaper_publish},
          {:restore_wallpaper_snapshot, :wallpaper_restore_snapshot}
        ] do
      assert Enum.any?(exports, fn {name, _arity} -> name == current end)
      refute Enum.any?(exports, fn {name, _arity} -> name == previous end)
    end
  end

  test "home preparation preserves the managed shared seed result" do
    assert {:ok, %{slug: "home"}} =
             GroupherServer.Seed.Home.Prepare.run(fn -> {:ok, %{slug: "home"}} end)
  end

  test "theme scenario can be repeated without creating duplicate resources" do
    {:ok, owner} = db_insert(:user)
    {:ok, editor} = db_insert(:user)
    {:ok, limited} = db_insert(:user)
    register(owner, "owner")
    register(editor, "editor")
    register(limited, "limited")

    assert {:ok, first} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Scenario.ThemePermissions.run("fixture-test", %{
                 "community" => "seed-theme-scenario"
               })
             end)

    assert {:ok, second} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Scenario.ThemePermissions.run("fixture-test", %{
                 "community" => "seed-theme-scenario"
               })
             end)

    assert first.community.communityRef == second.community.communityRef
    assert first.editor_invite.requestId == second.editor_invite.requestId
    assert first.limited_invite.requestId == second.limited_invite.requestId
    community = Repo.get_by!(CMS.Model.Community, slug: "seed-theme-scenario")
    assert {:ok, editor_facts} = CMS.Passport.community_facts(editor.id, community.id)
    assert {:ok, limited_facts} = CMS.Passport.community_facts(limited.id, community.id)
    assert editor_facts.permissions["dashboard.theme.update"]
    refute limited_facts.permissions["dashboard.theme.update"]
  end

  test "community fixture records owner membership and rejects conflicting reuse" do
    {:ok, owner} = db_insert(:user)
    register(owner, "owner")
    input = %{"owner" => "owner", "slug" => "seed-test-community", "title" => "Seed test"}

    assert {:ok, created} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.Create.run("fixture-test", input)
             end)

    assert {:ok, repeated} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.Create.run("fixture-test", input)
             end)

    assert created.communityRef == repeated.communityRef

    unique_error =
      %CMS.Model.Community{}
      |> Ecto.Changeset.change()
      |> Ecto.Changeset.add_error(:slug, "has already been taken",
        constraint: :unique,
        constraint_name: "communities_raw_index"
      )

    assert {:error, :local_test_community_collision} =
             GroupherServer.Seed.Community.Create.resolve_slug_conflict(
               {:error, {:pipeline_rejection, unique_error}},
               input
             )

    assert {:error, :local_test_key_conflict} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.Create.run("fixture-test", %{
                 input
                 | "title" => "Changed"
               })
             end)

    assert {:ok, %{status: "cleaned", communities_retained: retained}} =
             GroupherServer.Seed.Cleanup.Run.apply("fixture-test")

    assert Enum.all?(GroupherServer.Seed.Run.bindings("fixture-test"), fn binding ->
             binding.raw["status"] == "closed" and binding.raw["cleanup_status"] == "cleaned" and
               binding.raw["cleanup_report"]["pending_requests"] == 0
           end)

    assert [%{slug: "seed-test-community", lifecycle: :archived}] = retained

    assert {:error, {:slug_retained, :archived}} =
             GroupherServer.Seed.Community.Create.resolve_slug_conflict(
               {:error, unique_error},
               input
             )

    other_error =
      Ecto.Changeset.add_error(Ecto.Changeset.change(%CMS.Model.Community{}), :title, "bad")

    assert {:error, ^other_error} =
             GroupherServer.Seed.Community.Create.resolve_slug_conflict(
               {:error, other_error},
               input
             )

    assert Repo.get_by!(CMS.Model.CommunityAdmin, user_id: owner.id).id == created.admin.memberId

    {:ok, next_owner} = db_insert(:user)
    register(next_owner, "owner", "fixture-next")

    assert {:error, {:slug_retained, :archived}} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.Create.run("fixture-next", input)
             end)

    assert {:ok, next} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.Create.run("fixture-next", %{
                 input
                 | "slug" => "seed-test-community-next"
               })
             end)

    assert next.communityRef != created.communityRef
  end

  test "seed invitation retries its key and rejects different input" do
    {community, _, _, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    register(owner, "owner")
    register(subject, "editor")

    input = %{
      "by" => "owner",
      "to" => "editor",
      "community" => community.slug,
      "key" => "editor-invite",
      "permissions" => %{}
    }

    assert {:ok, first} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.Invite.run("fixture-test", input)
             end)

    assert {:ok, second} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.Invite.run("fixture-test", input)
             end)

    assert first.requestId == second.requestId

    assert {:ok, [%{id: request_id}]} = CMS.list_own_pending_community_admin_requests(owner)
    assert request_id == first.requestId
    assert {:ok, [%{id: ^request_id}]} = CMS.list_own_pending_community_admin_requests(subject)
    {:ok, outsider} = db_insert(:user)
    assert {:ok, []} = CMS.list_own_pending_community_admin_requests(outsider)
    assert {:ok, %{pending_requests: 1}} = GroupherServer.Seed.Cleanup.Run.report("fixture-test")

    accept = %{"alias" => "editor", "invite" => "editor-invite"}

    assert {:ok, accepted} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.Accept.run("fixture-test", accept)
             end)

    assert {:ok, repeated} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.Accept.run("fixture-test", accept)
             end)

    assert accepted.requestId == first.requestId
    assert repeated.requestId == first.requestId
    assert {:ok, []} = CMS.list_own_pending_community_admin_requests(owner)

    assert {:error, _} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.Invite.run("fixture-test", %{
                 input
                 | "by" => "editor",
                   "to" => "owner",
                   "key" => "editor-forbidden"
               })
             end)

    change = %{
      "by" => "owner",
      "member" => "editor",
      "community" => community.slug,
      "key" => "update",
      "permissions" => %{}
    }

    assert {:ok, updated} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.SetPermissions.run("fixture-test", change)
             end)

    assert {:ok, replayed} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.SetPermissions.run("fixture-test", change)
             end)

    assert updated.member_id == replayed.member_id
    assert {:ok, _json} = Jason.encode(updated)
    assert updated.revision == replayed.revision
    assert replayed.subsequent_update == false
    second_change = Map.put(change, "key", "update-again")

    assert {:ok, later} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.SetPermissions.run(
                 "fixture-test",
                 second_change
               )
             end)

    assert {:ok, old_key} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.SetPermissions.run("fixture-test", change)
             end)

    assert old_key.revision == later.revision
    assert old_key.subsequent_update
    removal = Map.put(change, "key", "remove")

    assert {:ok, true} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.Remove.run("fixture-test", removal)
             end)

    assert {:error, %ErrorCat.Error{reason: :command_result_unavailable}} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.SetPermissions.run("fixture-test", change)
             end)

    assert {:ok, true} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.Remove.run("fixture-test", removal)
             end)

    assert {:error, :local_test_key_conflict} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Admin.Invite.run("fixture-test", %{
                 input
                 | "permissions" => %{"dashboard.theme.update" => true}
               })
             end)
  end

  test "a run owner can request destruction and retry the same operation" do
    {:ok, owner} = db_insert(:user)
    {:ok, stranger} = db_insert(:user)
    register(owner, "owner")
    register(stranger, "stranger")

    assert {:ok, created} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.Create.run("fixture-test", %{
                 "owner" => "owner",
                 "slug" => "seed-request-destroy"
               })
             end)

    input = %{"by" => "owner", "slug" => "seed-request-destroy"}

    assert {:ok, first} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.RequestDestroy.run("fixture-test", input)
             end)

    assert first.communityRef == created.communityRef
    assert first.lifecycle == :archived

    assert {:ok, ^first} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.RequestDestroy.run("fixture-test", input)
             end)

    assert {:error, :local_test_community_not_owned} =
             Repo.transact_result(fn ->
               GroupherServer.Seed.Community.RequestDestroy.run("fixture-test", %{
                 input
                 | "by" => "stranger"
               })
             end)
  end

  test "clean refuses an account linked to another OAuth identity without closing it" do
    {:ok, user} = db_insert(:user)
    register(user, "linked")

    Repo.insert!(%OauthProvider{
      provider: "github",
      provider_id: "external-#{user.id}",
      user_id: user.id,
      public_ref: "oauth_" <> Ecto.UUID.generate()
    })

    assert {:ok, %{status: "blocked", blockers: ["unexpected_oauth_identity"]}} =
             GroupherServer.Seed.Cleanup.Run.apply("fixture-test")

    assert {:ok, _, _} = GroupherServer.Seed.Run.actor("fixture-test", "linked")
  end

  test "clean report is read-only; apply removes only run grants and retains shared community/content" do
    {community, public, _, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)

    if root = Repo.get_by(CMS.Model.GlobalPassport, user_id: owner.id) do
      Repo.delete!(root)
    end

    register(owner, "owner")
    register(subject, "editor")

    assert {:ok, _} =
             Repo.transact_result(fn ->
               Grants.configure("fixture-test", %{
                 "alias" => "owner",
                 "community" => community.slug,
                 "role" => "lord"
               })
             end)

    input = %{
      "alias" => "editor",
      "by" => "owner",
      "article" => public.id,
      "permissions" => @permissions
    }

    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)
    assert {:ok, plan} = GroupherServer.Seed.Cleanup.Run.report("fixture-test")
    assert plan.coauthors == 1
    assert plan.communities_to_archive == []
    assert GroupherServer.Seed.Run.actor("fixture-test", "editor") |> elem(0) == :ok

    assert {:ok, %{status: "cleaned", coauthors: 0, admins: 1, admins_to_remove: 0}} =
             GroupherServer.Seed.Cleanup.Run.apply("fixture-test")

    assert Repo.get!(CMS.Model.Community, community.id)
    assert Repo.get!(Article, public.id)
    assert Repo.get!(Accounts.Model.User, subject.id)

    assert Repo.get_by(ArticleCoAuthorEvent,
             article_id: public.id,
             subject_user_id: subject.id,
             type: :exit
           )

    assert {:error, :local_test_actor_unavailable} =
             GroupherServer.Seed.Run.actor("fixture-test", "editor")

    assert {:ok, %{status: "cleaned"}} = GroupherServer.Seed.Cleanup.Run.apply("fixture-test")
  end

  test "local lord initialization is scoped, idempotent and refuses ordinary Admin promotion" do
    {community, _, _, _} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    register(subject, "lord")
    input = %{"alias" => "lord", "community" => community.slug, "role" => "lord"}

    assert {:ok, %{isLord: true}} =
             Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    assert {:ok, %{isLord: true}} =
             Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    assert {:ok, facts} = CMS.Passport.community_facts(subject.id, community.id)
    assert facts.is_lord
    assert facts.revision == 1
    assert {:ok, memberships} = LocalTestActors.Communities.memberships(subject)
    assert length(memberships) == 1

    assert {:ok, [%{community_ref: ref, is_lord: true, member_id: member_id}]} =
             CMS.list_own_community_admin_memberships(subject)

    assert ref == community.ref
    assert is_integer(member_id)
    {:ok, outsider} = db_insert(:user)
    assert {:ok, []} = CMS.list_own_community_admin_memberships(outsider)
    assert {:error, :permission_denied} = CMS.list_own_community_admin_memberships(nil)

    {:ok, ordinary} = db_insert(:user)
    register(ordinary, "ordinary")

    member =
      Repo.insert!(
        CMS.Model.CommunityAdmin.changeset(%CMS.Model.CommunityAdmin{}, %{
          user_id: ordinary.id,
          community_id: community.id,
          permissions: %{}
        })
      )

    assert {:error, :local_test_refuses_implicit_lord_promotion} =
             Repo.transact_result(fn ->
               Grants.configure("fixture-test", %{input | "alias" => "ordinary"})
             end)

    refute Repo.get!(CMS.Model.CommunityAdmin, member.id).is_lord
  end

  test "cleanup removes a newly granted lord only once" do
    {community, _, _, _} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    register(subject, "lord")
    input = %{"alias" => "lord", "community" => community.slug, "role" => "lord"}

    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)
    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    member =
      Repo.get_by!(CMS.Model.CommunityAdmin, user_id: subject.id, community_id: community.id)

    assert {:ok, %{status: "cleaned"}} = GroupherServer.Seed.Cleanup.Run.apply("fixture-test")
    refute Repo.get(CMS.Model.CommunityAdmin, member.id)
    assert {:ok, %{status: "cleaned"}} = GroupherServer.Seed.Cleanup.Run.apply("fixture-test")
  end

  test "cleanup restores the original global grant" do
    {:ok, subject} = db_insert(:user)
    register(subject, "global")

    before =
      Repo.insert!(
        CMS.Model.GlobalPassport.changeset(%CMS.Model.GlobalPassport{}, %{
          user_id: subject.id,
          permissions: %{},
          revision: 1
        })
      )

    input = %{
      "alias" => "global",
      "scope" => "global",
      "permissions" => %{"review.platform.read" => true}
    }

    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)
    updated = Repo.get!(CMS.Model.GlobalPassport, before.id)
    assert updated.permissions["review.platform.read"]
    assert {:ok, %{status: "cleaned"}} = GroupherServer.Seed.Cleanup.Run.apply("fixture-test")
    assert Repo.get!(CMS.Model.GlobalPassport, before.id).permissions == %{}
    assert {:ok, %{status: "cleaned"}} = GroupherServer.Seed.Cleanup.Run.apply("fixture-test")
  end

  test "cleanup removes a newly created global grant once" do
    {:ok, subject} = db_insert(:user)
    register(subject, "global")

    input = %{
      "alias" => "global",
      "scope" => "global",
      "permissions" => %{"review.platform.read" => true}
    }

    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)
    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)
    assert Repo.get_by(CMS.Model.GlobalPassport, user_id: subject.id)
    assert {:ok, %{status: "cleaned"}} = GroupherServer.Seed.Cleanup.Run.apply("fixture-test")
    refute Repo.get_by(CMS.Model.GlobalPassport, user_id: subject.id)
    assert {:ok, %{status: "cleaned"}} = GroupherServer.Seed.Cleanup.Run.apply("fixture-test")
  end

  test "cleanup blocks when a global grant was modified after the fixture grant" do
    {:ok, subject} = db_insert(:user)
    register(subject, "global")

    input = %{
      "alias" => "global",
      "scope" => "global",
      "permissions" => %{"review.platform.read" => true}
    }

    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)
    grant = Repo.get_by!(CMS.Model.GlobalPassport, user_id: subject.id)
    grant |> Ecto.Changeset.change(revision: grant.revision + 1) |> Repo.update!()

    assert {:ok, %{status: "blocked", blockers: blockers}} =
             GroupherServer.Seed.Cleanup.Run.apply("fixture-test")

    assert "global_grant_provenance_unknown" in blockers
    assert {:ok, _, _} = GroupherServer.Seed.Run.actor("fixture-test", "global")
  end

  test "co-author setup records real request, membership, event and scoped permission facts" do
    {_community, public, _, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    register(owner, "owner")
    register(subject, "editor")
    article = Repo.get!(Article, public.id) |> Repo.preload(:author)

    input = %{
      "alias" => "editor",
      "by" => "owner",
      "article" => article.id,
      "permissions" => @permissions
    }

    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    request =
      Repo.get_by!(ArticleCoAuthorRequest, article_id: article.id, subject_user_id: subject.id)

    assert request.status == :decided and request.decision == :accept
    author = Repo.get_by!(Author, user_id: subject.id)
    member = Repo.get_by!(ArticleCoAuthor, article_id: article.id, author_id: author.id)
    assert member.permissions == @permissions

    assert Repo.get_by(ArticleCoAuthorEvent,
             article_id: article.id,
             member_id: member.id,
             type: :join
           )

    assert {:ok, scope} = CMS.Passport.load_article_scope(subject, article)
    assert {:ok, true} = CMS.Passport.allowed?(subject, scope, "article.update")
    assert {:ok, false} = CMS.Passport.allowed?(subject, scope, "article.publish")

    assert {:error, :permission_dependency_missing} =
             Repo.transact_result(fn ->
               Grants.configure("fixture-test", %{
                 input
                 | "permissions" => %{"article.update" => true}
               })
             end)

    assert Repo.get!(ArticleCoAuthor, member.id).permissions == @permissions
  end

  test "pending co-author setup leaves permission facts unchanged until acceptance" do
    {_community, public, _, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    register(owner, "owner")
    register(subject, "editor")

    input = %{
      "alias" => "editor",
      "by" => "owner",
      "article" => public.id,
      "permissions" => @permissions,
      "pending" => true
    }

    assert {:ok, %{status: "pending"}} =
             Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    request =
      Repo.get_by!(ArticleCoAuthorRequest, article_id: public.id, subject_user_id: subject.id)

    assert request.status == :pending
    refute Repo.get_by(Author, user_id: subject.id)
  end

  defp register(user, name, run \\ "fixture-test") do
    Repo.insert!(%OauthProvider{
      provider: "local-test-actor-v1",
      provider_id: "#{run}/#{name}",
      user_id: user.id,
      public_ref: "oauth_" <> Ecto.UUID.generate(),
      raw: %{
        "tool" => "local-test-actor-v1",
        "run" => run,
        "alias" => name,
        "status" => "active",
        "communities" => []
      }
    })
  end
end
