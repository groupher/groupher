defmodule GroupherServer.Test.CMS.Gate.Access do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias CMS.Gate.Decision
  alias CMS.Gate.Context.Access.Article, as: ArticleAccess
  alias CMS.Gate.Context.Access.Comment, as: CommentAccess
  alias CMS.Gate.Context.Access.Community, as: CommunityAccess
  alias CMS.Model.{ArticleLifecycle, Comment, CommentLifecycle, CommunityLifecycle}

  test "community access rejects unregistered actions" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    assert {:error, :unknown_action} = CMS.Gate.Access.check_access(user, :purge, community)

    assert {:error, :unknown_action} =
             CMS.Gate.Access.Community.check_access(
               user,
               :purge,
               community,
               community_context(community)
             )

    assert {:error, :unknown_action} = CMS.Gate.Access.check_access(user, :read_draft, community)
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

    assert :ok = CMS.Gate.Access.check_access(owner, :restore, community)
    assert :ok = CMS.Gate.Access.check_access(owner, :schedule_destroy, community)

    assert {:error, :permission_denied} =
             CMS.Gate.Access.check_access(other_user, :destroy, community)

    assert {:error, :permission_denied} =
             CMS.Gate.Access.Community.check_access(
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

    assert :ok = CMS.Gate.Access.check_access(nil, :read, community)
    assert :ok = CMS.Gate.Access.check_access(owner, :read, community)

    assert :ok =
             CMS.Gate.Access.check_access(owner, :read, community, community_context(community))

    assert {:error, :unknown_action} = CMS.Gate.Access.check_access(other_user, :write, community)
    assert {:error, :unknown_action} = CMS.Gate.Access.check_access(owner, :manage, community)
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
      article_hash_id: Ecto.UUID.generate(),
      meta: %{is_comment_locked: false}
    }

    archived_context = %ArticleAccess{
      community: community,
      community_lifecycle: community.lifecycle,
      article: article,
      article_lifecycle: %ArticleLifecycle{state: :archived}
    }

    assert {:error, :article_archived} =
             CMS.Gate.Access.Article.check_access(
               user,
               :publish,
               article,
               archived_context
             )

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.Article.check_access(
               user,
               :create_comment,
               article,
               archived_context
             )

    decision =
      CMS.Gate.Access.Article.check_access(user, :publish, article, archived_context)
      |> Decision.from_result(archived_context)

    refute decision.allowed

    assert %{
             reason: :article_archived,
             err_code: 4609,
             source: :lifecycle,
             actions: [:read_only_notice]
           } =
             decision.primary

    assert {:error, :article_archived} = {:error, Decision.primary_reason(decision)}
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

    published_context = %ArticleAccess{
      community: community,
      community_lifecycle: community.lifecycle,
      article: article,
      article_lifecycle: %ArticleLifecycle{state: :published}
    }

    for action <- [:upvote, :emotion, :collect] do
      assert :ok =
               CMS.Gate.Access.Article.check_access(
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
      assert {:error, :article_archived} =
               CMS.Gate.Access.Article.check_access(
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

    read_only_context = %ArticleAccess{
      published_context
      | community: read_only_community,
        community_lifecycle: read_only_community.lifecycle
    }

    assert {:error, :ancestor_community_not_writable} =
             CMS.Gate.Access.Article.check_access(
               user,
               :upvote,
               article,
               read_only_context
             )

    assert {:error, :article_not_mutable} =
             CMS.Gate.Access.Article.check_access(
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

    context = %ArticleAccess{
      article: article,
      community: %{community | lifecycle: lifecycle},
      community_lifecycle: lifecycle,
      article_lifecycle: %ArticleLifecycle{state: :published}
    }

    assert {:error, :ancestor_community_not_writable} =
             CMS.Gate.Access.Article.check_access(user, :create_comment, article, context)
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

    context = %CommentAccess{
      comment: %Comment{},
      article: article,
      community: community,
      community_lifecycle: community.lifecycle,
      article_lifecycle: %ArticleLifecycle{state: :archived},
      comment_lifecycle: %CommentLifecycle{state: :visible}
    }

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.Comment.check_access(
               user,
               :reply_comment,
               %Comment{},
               context
             )

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.Comment.check_access(user, :edit, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.Comment.check_access(user, :delete, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.Comment.check_access(user, :upvote, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.Comment.check_access(user, :emotion, %Comment{}, context)

    assert {:error, :ancestor_article_archived} =
             CMS.Gate.Access.Comment.check_access(user, :pin, %Comment{}, context)
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

  defp community_context(community) do
    %CommunityAccess{
      community: community,
      community_lifecycle: Map.get(community, :lifecycle)
    }
  end
end
