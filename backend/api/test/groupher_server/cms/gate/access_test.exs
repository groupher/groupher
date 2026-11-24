defmodule GroupherServer.Test.CMS.Gate.Access do
  @moduledoc false
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.Gate.{Access.Check, Decision}
  alias CMS.Gate.Access.Policy.Article, as: ArticlePolicy
  alias CMS.Gate.Access.Policy.Comment, as: CommentPolicy
  alias CMS.Gate.Access.Policy.Community, as: CommunityPolicy
  alias CMS.Gate.Access.Load.Query, as: LoadQuery
  alias CMS.Gate.Context.Access.Article, as: ArticleContext
  alias CMS.Gate.Context.Access.Comment, as: CommentContext
  alias CMS.Gate.Context.Access.Community, as: CommunityContext
  alias CMS.Model.{Article, ArticleLifecycle, Comment, CommentLifecycle, CommunityLifecycle}

  test "access_check rejects unsupported resources without raising" do
    assert {:error, %Decision{primary: %{reason: :unsupported_resource}}} =
             CMS.Gate.access_check(nil, :upvote, %{community_id: 1})

    assert {:error, %Decision{primary: %{reason: :unsupported_resource}}} =
             Check.article(nil, :upvote, %{community_id: 1})
  end

  test "community access rejects unregistered actions" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert {:error, %ErrorCat.Error{reason: :unknown_action}} =
             CommunityPolicy.check_access(user, :purge, community)

    assert {:error, %ErrorCat.Error{reason: :unknown_action}} =
             CommunityPolicy.check_access(
               user,
               :purge,
               community,
               community_context(community)
             )

    assert {:error, %ErrorCat.Error{reason: :unknown_action}} =
             CommunityPolicy.check_access(user, :read_draft, community)
  end

  test "community command actions use the manage binding preflight" do
    {:ok, owner} = db_insert(:user)
    {:ok, other_user} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    lifecycle =
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: :archived})
      |> Repo.update!()

    community = %{community | lifecycle: lifecycle}

    assert {:ok, :pass} = CommunityPolicy.check_access(owner, :restore, community)
    assert {:ok, :pass} = CommunityPolicy.check_access(owner, :schedule_destroy, community)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CommunityPolicy.check_access(other_user, :destroy, community)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CommunityPolicy.check_access(
               other_user,
               :request_destroy,
               community,
               community_context(community)
             )
  end

  test "community access keeps state capability separate from concrete Gate actions" do
    {:ok, owner} = db_insert(:user)
    {:ok, other_user} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    lifecycle =
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: :read_only})
      |> Repo.update!()

    community = %{community | lifecycle: lifecycle}

    assert {:ok, :pass} = CommunityPolicy.check_access(nil, :read, community)
    assert {:ok, :pass} = CommunityPolicy.check_access(owner, :read, community)

    assert {:ok, :pass} =
             CommunityPolicy.check_access(
               owner,
               :read,
               community,
               community_context(community)
             )

    assert {:error, %ErrorCat.Error{reason: :unknown_action}} =
             CommunityPolicy.check_access(other_user, :write, community)

    assert {:error, %ErrorCat.Error{reason: :unknown_action}} =
             CommunityPolicy.check_access(owner, :manage, community)
  end

  test "Document management access uses the same writable Community guard" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    assert {:ok, %CMS.Model.Community{}} =
             CMS.Gate.access_check(owner, :manage_docs, community)

    lifecycle =
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: :suspended})
      |> Repo.update!()

    assert {:error, %Decision{primary: %{reason: :ancestor_community_not_writable}}} =
             CMS.Gate.access_check(owner, :manage_docs, %{community | lifecycle: lifecycle})
  end

  test "Docs queue and history require separate Passport grants and Lifecycle capabilities" do
    {:ok, owner} = db_insert(:user)
    {:ok, editor} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    lifecycle = Repo.get_by!(CommunityLifecycle, community_id: community.id)
    community = %{community | lifecycle: lifecycle}

    context = %CommunityContext{
      community: community,
      community_lifecycle: lifecycle,
      community_passport_scope:
        community_passport_scope(editor, community, %{"doc.queue.preview" => true})
    }

    assert {:ok, :pass} =
             CommunityPolicy.check_access(editor, :docs_queue_preview, community, context)

    for action <- [
          :docs_queue_write,
          :docs_queue_approve,
          :docs_queue_configure,
          :docs_queue_publish,
          :docs_history_read
        ] do
      assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
               CommunityPolicy.check_access(editor, action, community, context)
    end

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CommunityPolicy.check_access(nil, :docs_queue_preview, community, context)

    granted = %{
      context
      | community_passport_scope:
          community_passport_scope(editor, community, %{
            "doc.queue.preview" => true,
            "doc.queue.write" => true,
            "doc.queue.approve" => true,
            "doc.queue.configure" => true,
            "doc.queue.publish" => true,
            "doc.history.read" => true
          })
    }

    for action <- [
          :docs_queue_preview,
          :docs_queue_write,
          :docs_queue_approve,
          :docs_queue_configure,
          :docs_queue_publish,
          :docs_history_read
        ] do
      assert {:ok, :pass} = CommunityPolicy.check_access(editor, action, community, granted)
    end

    read_only = %{lifecycle | state: :read_only}
    read_only_context = %{granted | community_lifecycle: read_only}

    assert {:ok, :pass} =
             CommunityPolicy.check_access(
               editor,
               :docs_history_read,
               community,
               read_only_context
             )

    assert {:error, %ErrorCat.Error{reason: :ancestor_community_not_writable}} =
             CommunityPolicy.check_access(editor, :docs_queue_write, community, read_only_context)

    assert {:error, %Decision{allowed: false}} =
             CMS.Gate.access_check(editor, :docs_queue_preview, community)
  end

  test "Community access_check keeps owner reads on the public mode by default" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    Repo.get_by!(CommunityLifecycle, community_id: community.id)
    |> CommunityLifecycle.changeset(%{state: :suspended})
    |> Repo.update!()

    assert {:error, %Decision{allowed: false}} =
             CMS.Gate.access_check(owner, :read, community)
  end

  test "article commands consume only the loaded Lifecycle context" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      author_id: user.id,
      author: %{user_id: user.id},
      meta: %{is_comment_locked: false}
    }

    archived_context = %ArticleContext{
      community: community,
      community_lifecycle: community.lifecycle,
      article: article,
      article_passport_scope: article_passport_scope(user, article),
      article_lifecycle: %ArticleLifecycle{state: :archived}
    }

    assert {:error, %ErrorCat.Error{reason: :article_archived}} =
             ArticlePolicy.check_access(
               user,
               :publish,
               archived_context
             )

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             ArticlePolicy.check_access(
               user,
               :create_comment,
               archived_context
             )

    decision =
      ArticlePolicy.check_access(user, :publish, archived_context)
      |> Decision.from_result(archived_context)

    refute decision.allowed

    assert %{
             reason: :article_archived,
             err_code: 4609,
             source: :lifecycle,
             actions: [:read_only_notice]
           } =
             decision.primary

    assert {:error, %ErrorCat.Error{reason: :article_archived}} =
             {:error, Decision.primary_error(decision)}
  end

  test "article edit admission accepts state-only lifecycle facts and fails closed" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      author_id: user.id,
      author: %{user_id: user.id},
      meta: %{is_comment_locked: false}
    }

    state_only_context = %ArticleContext{
      article: article,
      article_passport_scope: article_passport_scope(user, article),
      community: community,
      community_lifecycle: community.lifecycle,
      article_lifecycle: %{state: :published}
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(user, :edit, state_only_context)

    invalid_context = %{state_only_context | article_lifecycle: %{state: :unknown}}

    assert {:error, %ErrorCat.Error{reason: :lifecycle_not_found}} =
             ArticlePolicy.check_access(user, :edit, invalid_context)
  end

  test "ordinary Article edit admission consumes Passport article.update for co-authors" do
    {:ok, owner} = db_insert(:user)
    {:ok, member} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      author_id: owner.id,
      author: %{user_id: owner.id},
      meta: %{is_comment_locked: false}
    }

    article_scope = %{
      article_passport_scope(member, article)
      | membership: %{
          permissions: %{
            "article.read_draft" => true,
            "article.update" => true
          }
        }
    }

    context = %ArticleContext{
      article: article,
      article_passport_scope: article_scope,
      community: community,
      community_lifecycle: community.lifecycle,
      article_lifecycle: %ArticleLifecycle{state: :published},
      published_article_editable?: true
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(member, :edit_article, context)

    denied_context = %{context | article_passport_scope: article_passport_scope(member, article)}

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(member, :edit_article, denied_context)
  end

  test "co-author management admission requires the Article owner Passport Action" do
    {:ok, owner} = db_insert(:user)
    {:ok, stranger} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      author_id: owner.id,
      author: %{user_id: owner.id},
      meta: %{is_comment_locked: false}
    }

    context = %ArticleContext{
      article: article,
      article_passport_scope: article_passport_scope(owner, article),
      community: community,
      community_lifecycle: community.lifecycle,
      article_lifecycle: %ArticleLifecycle{state: :published}
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(owner, :manage_coauthors, context)

    stranger_context = %{
      context
      | article_passport_scope: article_passport_scope(stranger, article)
    }

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(stranger, :manage_coauthors, stranger_context)
  end

  test "co-author management Gate check works without an ArticleBinding" do
    {community, public, _, owner} = mock_article(:post)
    article = Repo.get!(Article, public.id)

    Repo.delete_all(
      from(binding in CMS.Model.ArticleBinding,
        where: binding.article_id == ^article.id and binding.community_id == ^community.id
      )
    )

    assert {:ok, canonical} = CMS.Gate.access_check(owner, :manage_coauthors, article)
    assert canonical.id == article.id

    assert {:ok, {:ok, canonical}} =
             Repo.transaction(fn ->
               Check.article(owner, :manage_coauthors, article)
             end)

    assert canonical.id == article.id
  end

  test "single Article read denies active restrictions except to the author" do
    {:ok, author} = db_insert(:user)
    {:ok, other_user} = db_insert(:user)
    {:ok, community} = mock_community(author)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      author_id: author.id,
      author: %{user_id: author.id},
      meta: %{is_comment_locked: false}
    }

    restricted_context = %ArticleContext{
      article: article,
      article_lifecycle: %ArticleLifecycle{state: :published},
      community: community,
      community_lifecycle: community.lifecycle,
      review_restricted?: true
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(author, :read, restricted_context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(other_user, :read, restricted_context)

    community_reader = other_user

    community_review_context = %{
      restricted_context
      | community_passport_scope:
          community_passport_scope(community_reader, community, %{"review.read" => true}),
        review_scope_keys: ["community:#{community.id}"]
    }

    assert {:ok, :pass} =
             ArticlePolicy.check_access(community_reader, :read, community_review_context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(
               community_reader,
               :read,
               %{
                 community_review_context
                 | review_scope_keys: ["platform", "community:#{community.id}"]
               }
             )

    platform_reader = other_user

    platform_review_context = %{
      community_review_context
      | passport_global_scope:
          global_passport_scope(platform_reader, %{"review.platform.read" => true})
    }

    assert {:ok, :pass} =
             ArticlePolicy.check_access(
               platform_reader,
               :read,
               %{
                 platform_review_context
                 | review_scope_keys: ["platform", "community:#{community.id}"]
               }
             )
  end

  test "article interactions use the same Article and Community admission matrix" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      author_id: user.id,
      meta: %{is_comment_locked: false}
    }

    published_context = %ArticleContext{
      community: community,
      community_lifecycle: community.lifecycle,
      article: article,
      article_lifecycle: %ArticleLifecycle{state: :published}
    }

    for action <- [:upvote, :emotion, :collect] do
      assert {:ok, :pass} =
               ArticlePolicy.check_access(
                 user,
                 action,
                 published_context
               )
    end

    archived_context = %{
      published_context
      | article_lifecycle: %ArticleLifecycle{state: :archived}
    }

    for action <- [:upvote, :emotion, :collect] do
      assert {:error, %ErrorCat.Error{reason: :article_archived}} =
               ArticlePolicy.check_access(
                 user,
                 action,
                 archived_context
               )
    end

    read_only_community = %{
      community
      | lifecycle: %{community.lifecycle | state: :read_only}
    }

    read_only_context = %ArticleContext{
      published_context
      | community: read_only_community,
        community_lifecycle: read_only_community.lifecycle
    }

    assert {:error, %ErrorCat.Error{reason: :ancestor_community_not_writable}} =
             ArticlePolicy.check_access(
               user,
               :upvote,
               read_only_context
             )

    assert {:error, %ErrorCat.Error{reason: :article_not_mutable}} =
             ArticlePolicy.check_access(
               user,
               :upvote,
               %CMS.Gate.Context.Access.Doc{
                 doc: article,
                 doc_lifecycle: %CMS.Model.ArticleLifecycle{state: :draft},
                 community: community,
                 community_lifecycle: community.lifecycle
               }
             )
  end

  test "article policy enforces Passport actions on direct domain calls" do
    {:ok, author} = db_insert(:user)
    {:ok, admin} = db_insert(:user)
    {:ok, unrelated} = db_insert(:user)
    {:ok, community} = mock_community(author)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      # Model a CMS Author ID colliding with an unrelated account ID. The
      # loaded linked user remains the only source of Article ownership.
      author_id: unrelated.id,
      author: %{id: unrelated.id, user_id: author.id},
      meta: %{is_comment_locked: false}
    }

    context = %ArticleContext{
      article: article,
      article_lifecycle: %ArticleLifecycle{state: :published},
      community: community,
      community_lifecycle: community.lifecycle,
      article_passport_scope: article_passport_scope(author, article)
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(author, :edit, context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(unrelated, :edit, context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(author, :pin, context)

    admin_context = %{
      context
      | community_passport_scope:
          community_passport_scope(admin, community, %{"post.pin" => true})
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(admin, :pin, admin_context)

    read_only_community = %{
      community
      | lifecycle: %{community.lifecycle | state: :read_only}
    }

    assert {:error, %ErrorCat.Error{reason: :ancestor_community_not_writable}} =
             ArticlePolicy.check_access(
               admin,
               :pin,
               %{
                 admin_context
                 | community: read_only_community,
                   community_lifecycle: read_only_community.lifecycle
               }
             )
  end

  test "comment policy applies owner fallback, Passport action, and login-only interactions" do
    {:ok, author} = db_insert(:user)
    {:ok, unrelated} = db_insert(:user)
    {:ok, community} = mock_community(author)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      id: Ecto.UUID.generate(),
      thread: :post,
      author: %{user_id: author.id},
      meta: %{is_comment_locked: false}
    }

    comment = %Comment{author_id: author.id}

    context = %CommentContext{
      public_readable?: true,
      comment: comment,
      comment_author_user_id: author.id,
      article: article,
      article_lifecycle: %ArticleLifecycle{state: :published},
      comment_lifecycle: %CommentLifecycle{state: :visible},
      community: community,
      community_lifecycle: community.lifecycle,
      article_passport_scope: article_passport_scope(author, article)
    }

    assert {:ok, :pass} = CommentPolicy.check_access(author, :edit, context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CommentPolicy.check_access(
               author,
               :edit,
               %{context | public_readable?: false}
             )

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CommentPolicy.check_access(unrelated, :edit, context)

    assert {:ok, :pass} = CommentPolicy.check_access(unrelated, :upvote, context)

    god = unrelated

    god_context = %{
      context
      | passport_global_scope: global_passport_scope(god, %{}, true),
        article_passport_scope: article_passport_scope(god, article, true)
    }

    assert {:ok, :pass} = CommentPolicy.check_access(god, :delete, god_context)
  end

  test "article mutation admission rejects a read-only community before writing" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    lifecycle =
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: :read_only})
      |> Repo.update!()

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      meta: %{is_comment_locked: false}
    }

    context = %ArticleContext{
      article: article,
      community: %{community | lifecycle: lifecycle},
      community_lifecycle: lifecycle,
      article_lifecycle: %ArticleLifecycle{state: :published}
    }

    assert {:error, %ErrorCat.Error{reason: :ancestor_community_not_writable}} =
             ArticlePolicy.check_access(user, :create_comment, context)
  end

  test "comment creation preserves deleted parent reasons before public-read admission" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      meta: %{is_comment_locked: false}
    }

    for {state, reason} <- [
          deleted: :ancestor_article_deleted,
          destroy: :ancestor_article_destroyed
        ] do
      context = %ArticleContext{
        article: article,
        community: community,
        community_lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id),
        article_lifecycle: %ArticleLifecycle{state: state}
      }

      assert {:error, %ErrorCat.Error{reason: ^reason}} =
               ArticlePolicy.check_access(user, :create_comment, context)
    end
  end

  test "comment reply preserves the ancestor lifecycle rejection" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    community = %{
      community
      | lifecycle: Repo.get_by!(CommunityLifecycle, community_id: community.id)
    }

    article = %{
      community_id: community.id,
      id: Ecto.UUID.generate(),
      thread: :post,
      meta: %{is_comment_locked: false}
    }

    context = %CommentContext{
      public_readable?: true,
      comment: %Comment{},
      article: article,
      community: community,
      community_lifecycle: community.lifecycle,
      article_lifecycle: %ArticleLifecycle{state: :archived},
      comment_lifecycle: %CommentLifecycle{state: :visible}
    }

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(
               user,
               :reply_comment,
               context
             )

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :edit, context)

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :delete, context)

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :upvote, context)

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :emotion, context)

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :pin, context)
  end

  test "viewer-aware community read hides suspended communities from non-owners" do
    import Ecto.Query

    {:ok, owner} = db_insert(:user)
    {:ok, other_user} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    Repo.get_by!(CommunityLifecycle, community_id: community.id)
    |> CommunityLifecycle.changeset(%{state: :suspended})
    |> Repo.update!()

    assert Repo.exists?(
             from(candidate in CMS.Model.Community, where: candidate.id == ^community.id)
           )

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :community},
              reason: :not_exist,
              details: "Community"
            }} =
             CMS.Communities.fetch(community.slug, owner, inc_views: false)

    assert {:ok, _} =
             CMS.Communities.fetch(community.slug, owner,
               inc_views: false,
               policy_mode: :owner
             )

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :community},
              reason: :not_exist,
              details: "Community"
            }} =
             CMS.Communities.fetch(community.slug, other_user, inc_views: false)
  end

  test "Community Access ignores embedded legacy passport facts" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    actor =
      Map.put(actor, :cur_passport, %{
        "global" => %{},
        community.slug => %{
          "cms" => %{"community.update" => true}
        }
      })

    assert {:error, %Decision{allowed: false}} = CMS.Gate.access_check(actor, :update, community)
  end

  test "Community Access loader passes database passport facts to Policy" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    Repo.insert!(
      CMS.Model.GlobalPassport.changeset(%CMS.Model.GlobalPassport{}, %{
        user_id: actor.id,
        permissions: %{"community.update" => true}
      })
    )

    assert {:ok, %CMS.Model.Community{}} = CMS.Gate.access_check(actor, :update, community)
  end

  test "Docs queue admission loads its grant from the database Passport" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    Repo.insert!(
      CMS.Model.CommunityAdmin.changeset(%CMS.Model.CommunityAdmin{}, %{
        user_id: actor.id,
        community_id: community.id,
        permissions: %{"doc.queue.preview" => true}
      })
    )

    assert {:ok, %CMS.Model.Community{}} =
             CMS.Gate.access_check(actor, :docs_queue_preview, community)

    assert {:error, %Decision{primary: %{reason: :permission_denied}}} =
             CMS.Gate.access_check(actor, :docs_queue_approve, community)
  end

  test "Community Access loader uses empty passport facts when no passport exists" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    assert {:ok, %CommunityContext{passport_global_scope: %{global: %{is_root: false}}}} =
             LoadQuery.community(actor, community)

    assert {:error, %Decision{allowed: false}} =
             CMS.Gate.access_check(actor, :update, community)
  end

  test "embedded legacy passport facts cannot authorize a Community command" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    actor =
      Map.put(actor, :cur_passport, %{
        "global" => %{},
        community.slug => %{"cms" => %{"community.update" => true}}
      })

    assert {:error, %Decision{allowed: false}} =
             CMS.Gate.access_check(actor, :update, community)
  end

  test "Community Access fails closed when passport loading fails" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    assert {:error, %Decision{allowed: false}} =
             CMS.Gate.access_check(
               %GroupherServer.Accounts.Model.User{id: -1},
               :update,
               community
             )
  end

  test "Community Policy fails closed for a manually incomplete context" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    context = %CommunityContext{
      community: community,
      community_lifecycle: nil
    }

    assert {:error, %ErrorCat.Error{reason: :lifecycle_not_loaded}} =
             CommunityPolicy.check_access(owner, :update, community, context)
  end

  test "Community Access fails closed when the Lifecycle fact is missing" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    Repo.delete_all(
      from(lifecycle in CommunityLifecycle, where: lifecycle.community_id == ^community.id)
    )

    assert {:error, %Decision{primary: %{reason: :lifecycle_not_found}}} =
             CMS.Gate.access_check(nil, :read, community)
  end

  defp community_context(community) do
    %CommunityContext{
      community: community,
      community_lifecycle: Map.get(community, :lifecycle)
    }
  end

  defp community_passport_scope(actor, community, permissions) do
    %CMS.Passport.Scope.Community{
      actor_id: actor.id,
      community_id: community.id,
      global: %{is_root: false, permissions: %{}},
      community: %{
        member_id: nil,
        revision: nil,
        is_lord: false,
        permissions: permissions
      }
    }
  end

  defp global_passport_scope(actor, permissions, is_root \\ false) do
    %CMS.Passport.Scope.Global{
      actor_id: actor.id,
      global: %{is_root: is_root, permissions: permissions}
    }
  end

  defp article_passport_scope(actor, article, is_root \\ false) do
    %CMS.Passport.Scope.Article{
      actor_id: actor.id,
      article_id: article.id,
      owner_user_id: article.author.user_id,
      global: %{is_root: is_root, permissions: %{}},
      membership: nil
    }
  end
end
