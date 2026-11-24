defmodule GroupherServer.Test.CMS.Passport.LoadedScopeTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, Author, GlobalPassport}
  alias CMS.Passport

  test "owner and root use actor bound Article facts without inventing membership" do
    {:ok, owner} = db_insert(:user)
    {:ok, other} = db_insert(:user)
    {:ok, root} = db_insert(:user)
    root_passport = Repo.get_by(GlobalPassport, user_id: root.id) || %GlobalPassport{}

    root_passport
    |> GlobalPassport.changeset(%{user_id: root.id, is_root: true})
    |> Repo.insert_or_update!()

    author = Repo.insert!(%Author{user_id: owner.id})
    article = %Article{id: Ecto.UUID.generate(), author: author}

    assert {:ok, owner_scope} = Passport.load_article_scope(owner, article)
    assert {:ok, true} = Passport.allowed?(owner, owner_scope, "article.update")

    assert {:error, :article_membership_unavailable} =
             Passport.grant_in_transaction(owner, owner_scope, %{}, nil)

    assert {:error, :article_membership_unavailable} =
             Passport.revoke_in_transaction(owner, owner_scope, [], nil)

    assert {:error, :permission_scope_mismatch} =
             Passport.allowed?(owner, owner_scope, "doc.queue.write")

    assert {:error, :unknown_action} = Passport.allowed?(owner, owner_scope, "article.future")
    assert {:error, :invalid_scope} = Passport.allowed?(other, owner_scope, "article.update")

    assert {:ok, other_scope} = Passport.load_article_scope(other, article)

    assert {:ok, false} = Passport.allowed?(other, other_scope, "article.update")

    assert {:ok, root_scope} = Passport.load_article_scope(root, article)
    assert {:ok, true} = Passport.allowed?(root, root_scope, "article.update")

    assert {:error, :invalid_scope} =
             Passport.load_article_scope(owner, %{article | author: %Ecto.Association.NotLoaded{}})
  end

  test "global scope rejects actor and scope mismatches" do
    {:ok, actor} = db_insert(:user)
    {:ok, other} = db_insert(:user)
    assert {:ok, scope} = Passport.load_global_scope(actor)
    assert {:ok, false} = Passport.allowed?(actor, scope, "community.application.review")

    assert {:error, :invalid_scope} =
             Passport.allowed?(other, scope, "community.application.review")

    assert {:error, :permission_scope_mismatch} =
             Passport.allowed?(actor, scope, "article.update")
  end

  test "authorization reads actual Global and Community rows with thread dependencies" do
    {:ok, actor} = db_insert(:user)
    {:ok, other} = db_insert(:user)
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    global =
      Repo.insert!(%GlobalPassport{
        user_id: actor.id,
        permissions: %{"community.application.review" => true}
      })

    admin =
      Repo.insert!(
        CMS.Model.CommunityAdmin.changeset(%CMS.Model.CommunityAdmin{}, %{
          user_id: actor.id,
          community_id: community.id,
          permissions: %{
            "community.article.hide" => true,
            "community.article.trash.read" => true
          }
        })
      )

    assert {:ok, global_scope} = Passport.load_global_scope(actor)
    assert {:ok, community_scope} = Passport.load_community_scope(actor, community)
    assert global_scope.global.permissions == global.permissions
    assert community_scope.community.member_id == admin.id

    assert {:ok, true} =
             Passport.allowed?(actor, global_scope, "community.application.review")

    assert {:ok, true} =
             Passport.allowed?(actor, community_scope, "community.article.hide", :post)

    assert {:ok, false} =
             Passport.allowed?(actor, community_scope, "community.article.hide", :doc)

    assert {:error, :thread_required} =
             Passport.allowed?(actor, community_scope, "community.article.hide")

    assert {:error, :unknown_thread} =
             Passport.allowed?(actor, community_scope, "community.article.hide", :unknown)

    assert {:error, :unknown_action} =
             Passport.allowed?(actor, community_scope, "community.article.unknown")

    assert {:error, :invalid_scope} =
             Passport.allowed?(other, community_scope, "community.article.hide", :post)
  end

  test "catalog is filtered by scope and unknown scopes fail closed" do
    assert {:ok, entries} = Passport.catalog(:article)
    assert Enum.any?(entries, &(&1.action == "article.update"))
    assert Enum.all?(entries, &(&1.metadata.scope == :article))
    assert {:error, :invalid_scope} = Passport.catalog(:unknown)
  end

  test "public authorization facade rejects unsupported scope values" do
    assert {:error, :invalid_scope} = Passport.allowed?(nil, %{}, "article.update")
    assert {:error, :invalid_scope} = Passport.allowed?(nil, %{}, "community.article.hide", :post)
  end

  test "Gate refuses malformed loaded Global facts rather than dropping them" do
    {community, public, _, actor} = mock_article(:post)
    article = Repo.get!(Article, public.id)

    passport = Repo.get_by!(GlobalPassport, user_id: actor.id)

    actor.id
    |> then(&Repo.get_by!(GlobalPassport, user_id: &1))
    |> Ecto.Changeset.change(permissions: %{"unknown.action" => true})
    |> Repo.update!()

    assert {:ok, {:error, %ErrorCat.Error{reason: :permission_denied}}} =
             Repo.transaction(fn ->
               CMS.Gate.Access.Load.article_in_community(actor, community, :post, article)
             end)
  end

  test "transactional grants bind subject, scope, identity and expected revision" do
    {:ok, subject} = db_insert(:user)
    {:ok, other} = db_insert(:user)
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CMS.Model.CommunityAdmin.changeset(%CMS.Model.CommunityAdmin{}, %{
          community_id: community.id,
          user_id: subject.id
        })
      )

    scope = %Passport.Scope.CommunityGrant{
      subject_id: subject.id,
      community_id: community.id,
      member: member
    }

    assert {:error, :invalid_scope} =
             Passport.grant_in_transaction(
               other,
               scope,
               %{"doc.queue.write" => true},
               member.revision
             )

    assert {:error, :permission_revision_conflict} =
             Passport.grant_in_transaction(
               subject,
               scope,
               %{"doc.queue.write" => true},
               member.revision + 1
             )

    assert {:ok, {:ok, updated}} =
             Repo.transaction(fn ->
               Passport.grant_in_transaction(
                 subject,
                 scope,
                 %{"doc.queue.write" => true},
                 member.revision
               )
             end)

    assert updated.permissions == %{"doc.queue.write" => true}

    assert {:ok, {:error, :permission_revision_conflict}} =
             Repo.transaction(fn ->
               Passport.revoke_in_transaction(
                 subject,
                 scope,
                 ["doc.queue.write"],
                 member.revision
               )
             end)

    fresh_scope = %{scope | member: updated}

    assert {:error, :invalid_scope} =
             Passport.revoke_in_transaction(subject, fresh_scope, %{}, updated.revision)

    assert {:ok, {:error, :unknown_action}} =
             Repo.transaction(fn ->
               Passport.revoke_in_transaction(subject, fresh_scope, [%{}], updated.revision)
             end)

    assert {:ok, {:ok, revoked}} =
             Repo.transaction(fn ->
               Passport.revoke_in_transaction(
                 subject,
                 fresh_scope,
                 ["doc.queue.write"],
                 updated.revision
               )
             end)

    assert revoked.permissions == %{}

    global = %Passport.Scope.GlobalGrant{subject_id: subject.id, current: nil}

    assert {:error, :transaction_required} =
             Passport.grant_in_transaction(
               subject,
               global,
               %{"community.application.review" => true},
               nil
             )

    assert {:ok, {:ok, row}} =
             Repo.transaction(fn ->
               Passport.grant_in_transaction(
                 subject,
                 global,
                 %{"community.application.review" => true},
                 nil
               )
             end)

    assert row.permissions == %{"community.application.review" => true}

    assert {:ok, {:error, :permission_revision_conflict}} =
             Repo.transaction(fn ->
               Passport.grant_in_transaction(
                 subject,
                 global,
                 %{"community.application.review" => true},
                 nil
               )
             end)

    assert {:error, :invalid_scope} =
             Passport.grant_in_transaction(subject, scope, [], member.revision)
  end

  test "Gate Community context loads only the current actor's scoped admin facts" do
    {:ok, owner} = db_insert(:user)
    {:ok, subject} = db_insert(:user)
    {:ok, outsider} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    member =
      Repo.insert!(
        CMS.Model.CommunityAdmin.changeset(%CMS.Model.CommunityAdmin{}, %{
          user_id: subject.id,
          community_id: community.id,
          permissions: %{"doc.queue.write" => true}
        })
      )

    assert {:ok, {:ok, context}} =
             Repo.transaction(fn -> CMS.Gate.Access.Load.community(subject, community) end)

    scope = context.community_passport_scope
    assert scope.actor_id == subject.id
    assert scope.community_id == community.id
    assert scope.community.member_id == member.id
    assert scope.community.revision == member.revision
    assert {:ok, true} = Passport.allowed?(subject, scope, "doc.queue.write", :doc)
    assert {:error, :invalid_scope} = Passport.allowed?(outsider, scope, "doc.queue.write", :doc)
  end
end
