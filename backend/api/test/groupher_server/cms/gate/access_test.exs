defmodule GroupherServer.Test.CMS.Gate.Access do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Gate.{Access.Check, Decision}
  alias CMS.Gate.Access.Policy.Article, as: ArticlePolicy
  alias CMS.Gate.Access.Policy.Comment, as: CommentPolicy
  alias CMS.Gate.Access.Policy.Community, as: CommunityPolicy
  alias CMS.Gate.Access.Load.Query, as: LoadQuery
  alias CMS.Gate.Context.Access.Article, as: ArticleContext
  alias CMS.Gate.Context.Access.Comment, as: CommentContext
  alias CMS.Gate.Context.Access.Community, as: CommunityContext
  alias CMS.Model.{ArticleLifecycle, Comment, CommentLifecycle, CommunityLifecycle}

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
      article_lifecycle: %ArticleLifecycle{state: :archived}
    }

    assert {:error, %ErrorCat.Error{reason: :article_archived}} =
             ArticlePolicy.check_access(
               user,
               :publish,
               article,
               archived_context
             )

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             ArticlePolicy.check_access(
               user,
               :create_comment,
               article,
               archived_context
             )

    decision =
      ArticlePolicy.check_access(user, :publish, article, archived_context)
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
      community: community,
      community_lifecycle: community.lifecycle,
      article_lifecycle: %{state: :published}
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(user, :edit, article, state_only_context)

    invalid_context = %{state_only_context | article_lifecycle: %{state: :unknown}}

    assert {:error, %ErrorCat.Error{reason: :lifecycle_not_found}} =
             ArticlePolicy.check_access(user, :edit, article, invalid_context)
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

    assert {:ok, :pass} = ArticlePolicy.check_access(author, :read, article, restricted_context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(other_user, :read, article, restricted_context)

    community_reader = %{
      other_user
      | cur_passport: %{"global" => %{}, community.slug => %{"cms" => %{"review.read" => true}}}
    }

    assert {:ok, :pass} =
             ArticlePolicy.check_access(
               community_reader,
               :read,
               article,
               %{
                 restricted_context
                 | passport_rules: community_reader.cur_passport,
                   review_scope_keys: ["community:#{community.id}"]
               }
             )

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(
               community_reader,
               :read,
               article,
               %{
                 restricted_context
                 | passport_rules: community_reader.cur_passport,
                   review_scope_keys: ["platform", "community:#{community.id}"]
               }
             )

    platform_reader = %{
      other_user
      | cur_passport: %{
          "global" => %{"review.platform.read" => true},
          community.slug => %{"cms" => %{"review.read" => true}}
        }
    }

    assert {:ok, :pass} =
             ArticlePolicy.check_access(
               platform_reader,
               :read,
               article,
               %{
                 restricted_context
                 | passport_rules: platform_reader.cur_passport,
                   review_scope_keys: ["platform", "community:#{community.id}"]
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
                 article,
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
                 article,
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
               article,
               read_only_context
             )

    assert {:error, %ErrorCat.Error{reason: :article_not_mutable}} =
             ArticlePolicy.check_access(
               user,
               :upvote,
               article,
               %CMS.Gate.Context.Access.Doc{
                 doc: article,
                 doc_lifecycle: published_context.article_lifecycle,
                 doc_branch: %{type: :preview},
                 community: community,
                 community_lifecycle: community.lifecycle
               }
             )
  end

  test "article policy enforces Passport actions on direct domain calls" do
    {:ok, author} = db_insert(:user)
    {:ok, moderator} = db_insert(:user)
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
      community_lifecycle: community.lifecycle
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(author, :edit, article, context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(unrelated, :edit, article, context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(author, :pin, article, context)

    moderator = %{
      moderator
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"post.pin" => true}}
        }
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(moderator, :pin, article, context)

    read_only_community = %{
      community
      | lifecycle: %{community.lifecycle | state: :read_only}
    }

    assert {:error, %ErrorCat.Error{reason: :ancestor_community_not_writable}} =
             ArticlePolicy.check_access(
               moderator,
               :pin,
               article,
               %{
                 context
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

    comment = %Comment{author_id: author.id}

    context = %CommentContext{
      comment: comment,
      comment_author_user_id: author.id,
      article: %{thread: :post, meta: %{is_comment_locked: false}},
      article_lifecycle: %ArticleLifecycle{state: :published},
      comment_lifecycle: %CommentLifecycle{state: :visible},
      community: community,
      community_lifecycle: community.lifecycle
    }

    assert {:ok, :pass} = CommentPolicy.check_access(author, :edit, comment, context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             CommentPolicy.check_access(unrelated, :edit, comment, context)

    assert {:ok, :pass} = CommentPolicy.check_access(unrelated, :upvote, comment, context)

    god = %{
      unrelated
      | cur_passport: %{"global" => %{"god" => true}}
    }

    assert {:ok, :pass} = CommentPolicy.check_access(god, :delete, comment, context)
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
             ArticlePolicy.check_access(user, :create_comment, article, context)
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
               %Comment{},
               context
             )

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :edit, %Comment{}, context)

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :delete, %Comment{}, context)

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :upvote, %Comment{}, context)

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :emotion, %Comment{}, context)

    assert {:error, %ErrorCat.Error{reason: :ancestor_article_archived}} =
             CommentPolicy.check_access(user, :pin, %Comment{}, context)
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
               policy_mode: :owner_management
             )

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :community},
              reason: :not_exist,
              details: "Community"
            }} =
             CMS.Communities.fetch(community.slug, other_user, inc_views: false)
  end

  test "Community Access loader passes embedded passport facts to Policy" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    actor = %{
      actor
      | cur_passport: %{
          "global" => %{},
          community.slug => %{
            "cms" => %{"community.update" => true}
          }
        }
    }

    assert {:ok, %CMS.Model.Community{}} = CMS.Gate.access_check(actor, :update, community)
  end

  test "Community Access loader passes database passport facts to Policy" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    assert {:ok, _passport} =
             CMS.Passport.stamp_passport(
               %{
                 "global" => %{},
                 community.slug => %{"cms" => %{"community.update" => true}}
               },
               actor
             )

    assert {:ok, %CMS.Model.Community{}} = CMS.Gate.access_check(actor, :update, community)
  end

  test "Community Access loader uses empty passport facts when no passport exists" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    assert {:ok, %CommunityContext{passport_rules: %{"global" => %{}}}} =
             LoadQuery.community(actor, community)

    assert {:error, %Decision{allowed: false}} =
             CMS.Gate.access_check(actor, :update, community)
  end

  test "embedded passport facts avoid a Passport query" do
    {:ok, owner} = db_insert(:user)
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    actor = %{
      actor
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"community.update" => true}}
        }
    }

    queries = capture_repo_queries(fn -> CMS.Gate.access_check(actor, :update, community) end)

    assert Enum.count(queries, &String.contains?(&1, "passports")) == 0
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
      community_lifecycle: nil,
      passport_rules: %{"global" => %{}}
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
      community_lifecycle: Map.get(community, :lifecycle),
      passport_rules: %{}
    }
  end

  defp capture_repo_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref} ->
          send(pid, {query_ref, metadata.query})
        end,
        {self(), ref}
      )

    try do
      _result = fun.()
      drain_queries(ref, [])
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end
end
