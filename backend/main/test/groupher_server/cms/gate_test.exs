defmodule GroupherServer.Test.CMS.Gate do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  require CMS.Const

  alias CMS.Gate.{Allow, Decision, Passport}
  alias CMS.Model.{ArticleLifecycle, Comment, CommentLifecycle, CommunityLifecycle}

  test "root facade exposes only scope and access_check" do
    assert function_exported?(CMS.Gate, :scope, 3)
    assert function_exported?(CMS.Gate, :scope, 4)
    assert function_exported?(CMS.Gate, :access_check, 3)
    assert function_exported?(CMS.Gate, :access_check, 4)
    refute function_exported?(CMS.Gate, :can, 3)
    refute function_exported?(CMS.Gate, :check, 3)
    refute function_exported?(CMS.Gate, :decide, 4)
  end

  test "four-arity access_check fails closed for non-read_draft actions" do
    {community, post, _attrs, user} = mock_article(:post)
    post = %{post | community: community}

    assert {:error, %Decision{primary: %{code: :unknown_action}}} =
             CMS.Gate.access_check(user, :upvote, post, %{})
  end

  test "read_draft access check uses the explicit management policy" do
    {community, _public, attrs, owner} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :post,
        Map.put(attrs, :title, "Draft for Gate"),
        owner
      )

    assert {:ok, ^draft} =
             CMS.Gate.access_check(owner, :read_draft, draft, %{
               policy_mode: :owner_management
             })

    {:ok, other_user} = db_insert(:user)

    assert {:error, %Decision{primary: %{code: :permission_denied}}} =
             CMS.Gate.access_check(other_user, :read_draft, draft, %{
               policy_mode: :owner_management
             })
  end

  test "Allow rules remain on their own module" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert {:ok, :post} = Allow.thread(community, :post)
    assert {:ok, :post_comment} = Allow.emotion(community.slug, :comment, :post, :beer)
  end

  test "passport check accepts a normalized global reviewer passport" do
    reviewer = %{cur_passport: %{"global" => %{"community.application.review" => true}}}

    assert {:ok, true} =
             Passport.check(reviewer, "community.application.review", %{})
  end

  test "passport check returns a stable denial" do
    reviewer = %{cur_passport: %{"global" => %{}}}

    assert {:error, :permission_denied} =
             Passport.check(reviewer, "community.application.review", %{})
  end

  test "community access rejects unregistered actions" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert {:error, :unknown_action} = CMS.Gate.Access.evaluate(user, :purge, community)
    assert {:error, :unknown_action} = CMS.Gate.Access.evaluate_result(user, :purge, community)
    assert {:error, :unknown_action} = CMS.Gate.Access.evaluate(user, :read_draft, community)
  end

  test "community command actions use the manage relation preflight" do
    {:ok, owner} = db_insert(:user)
    {:ok, other_user} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    lifecycle =
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: :archived})
      |> Repo.update!()

    community = %{community | lifecycle: lifecycle}

    assert {:ok, true} = CMS.Gate.Access.evaluate(owner, :restore, community)
    assert {:ok, true} = CMS.Gate.Access.evaluate(owner, :schedule_destroy, community)
    assert {:ok, false} = CMS.Gate.Access.evaluate(other_user, :destroy, community)

    assert {:error, :permission_denied} =
             CMS.Gate.Access.evaluate_result(other_user, :request_destroy, community)
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

    assert {:ok, true} = CMS.Gate.Access.evaluate(nil, :read, community)
    assert {:ok, true} = CMS.Gate.Access.evaluate(owner, :read, community)
    assert {:ok, true} = CMS.Gate.Access.evaluate(owner, :read, community, %{})
    assert {:error, :unknown_action} = CMS.Gate.Access.evaluate(other_user, :write, community)
    assert {:error, :unknown_action} = CMS.Gate.Access.evaluate(owner, :manage, community)
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

    assert {:error, %Decision{primary: %{code: :ancestor_community_not_writable}}} =
             CMS.Gate.access_check(owner, :manage_docs, %{community | lifecycle: lifecycle})
  end

  test "community read access follows the explicit policy mode matrix" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    for state <- CMS.Const.lifecycle_state_values() do
      lifecycle =
        Repo.get_by!(CommunityLifecycle, community_id: community.id)
        |> CommunityLifecycle.changeset(%{state: state})
        |> Repo.update!()

      community = %{community | lifecycle: lifecycle}
      public? = state in [:active, :read_only]
      management? = state != :destroy

      assert {:ok, ^public?} = CMS.Gate.Access.evaluate(owner, :read, community)

      assert {:ok, ^management?} =
               CMS.Gate.Access.evaluate(owner, :read, community, %{policy_mode: :owner_management})

      assert {:ok, true} =
               CMS.Gate.Access.evaluate(:operations, :read, community, %{policy_mode: :operations})
    end
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
      article_hash_id: Ecto.UUID.generate(),
      meta: %{is_comment_locked: false}
    }

    archived_context = %{
      community: community,
      article_lifecycle: %ArticleLifecycle{state: :archived}
    }

    assert {:error, :article_archived} =
             CMS.Gate.Access.evaluate_result(user, :publish, article, archived_context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.evaluate_result(user, :create_comment, article, archived_context)

    decision = CMS.Gate.Access.decision(user, :publish, article, archived_context)

    refute decision.allowed

    assert %{code: :article_archived, source: :lifecycle, actions: [:read_only_notice]} =
             decision.primary

    assert {:error, :article_archived} = {:error, Decision.primary_code(decision)}
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
      article_hash_id: Ecto.UUID.generate(),
      meta: %{is_comment_locked: false}
    }

    published_context = %{
      community: community,
      article_lifecycle: %ArticleLifecycle{state: :published}
    }

    for action <- [:upvote, :emotion, :collect] do
      assert {:ok, true} =
               CMS.Gate.Access.evaluate_result(user, action, article, published_context)
    end

    archived_context = %{
      published_context
      | article_lifecycle: %ArticleLifecycle{state: :archived}
    }

    for action <- [:upvote, :emotion, :collect] do
      assert {:error, :article_archived} =
               CMS.Gate.Access.evaluate_result(user, action, article, archived_context)
    end

    read_only_community = %{
      community
      | lifecycle: %{community.lifecycle | state: :read_only}
    }

    assert {:error, :ancestor_community_not_writable} =
             CMS.Gate.Access.evaluate_result(
               user,
               :upvote,
               article,
               %{published_context | community: read_only_community}
             )

    assert {:error, :article_not_mutable} =
             CMS.Gate.Access.evaluate_result(
               user,
               :upvote,
               article,
               Map.put(published_context, :doc_branch, %{type: :preview})
             )
  end

  test "structured decisions preserve every violation and choose the stable primary" do
    decision =
      Decision.deny([:permission_denied, :ancestor_article_archived], %{request_id: "req"})

    refute decision.allowed
    assert decision.context == %{request_id: "req"}
    assert decision.primary.code == :ancestor_article_archived

    assert Enum.map(decision.violations, & &1.code) == [
             :permission_denied,
             :ancestor_article_archived
           ]

    assert %{
             code: "ANCESTOR_ARTICLE_ARCHIVED",
             retryable: false,
             actions: ["READ_ONLY_NOTICE"],
             message: "当前内容处于只读状态。"
           } = Decision.public_error(decision)

    assert {:error,
            [
              message: "当前内容处于只读状态。",
              extensions: %{
                code: "ANCESTOR_ARTICLE_ARCHIVED",
                retryable: false,
                actions: ["READ_ONLY_NOTICE"]
              }
            ]} = Decision.graphql_error(decision)
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
      article_hash_id: Ecto.UUID.generate(),
      meta: %{is_comment_locked: false}
    }

    context = %{
      community: %{community | lifecycle: lifecycle},
      article_lifecycle: %ArticleLifecycle{state: :published}
    }

    assert {:error, :ancestor_community_not_writable} =
             CMS.Gate.Access.evaluate_result(user, :create_comment, article, context)
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
      article_hash_id: Ecto.UUID.generate(),
      meta: %{is_comment_locked: false}
    }

    context = %{
      article: article,
      community: community,
      article_lifecycle: %ArticleLifecycle{state: :archived},
      comment_lifecycle: %CommentLifecycle{state: :visible}
    }

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.evaluate_result(user, :reply_comment, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.evaluate_result(user, :edit, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.evaluate_result(user, :delete, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.evaluate_result(user, :upvote, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.evaluate_result(user, :emotion, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.evaluate_result(user, :pin, %Comment{}, context)
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

    assert {:error, {:not_exist, "Community"}} =
             CMS.Communities.Reader.fetch(community.slug, owner, inc_views: false)

    assert {:ok, _} =
             CMS.Communities.Reader.fetch(community.slug, owner,
               inc_views: false,
               policy_mode: :owner_management
             )

    assert {:error, {:not_exist, "Community"}} =
             CMS.Communities.Reader.fetch(community.slug, other_user, inc_views: false)
  end
end
