defmodule GroupherServer.Test.CMS.Passport.ArticleCoAuthorTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorRequest, Author}
  alias CMS.Passport

  test "member facts and SQL scope share actor identity, dependencies and owner boundary" do
    {_community, public, _, owner} = mock_article(:post)
    article = Repo.get!(Article, public.id) |> Repo.preload(:author)
    {:ok, member_user} = db_insert(:user)
    {:ok, stranger} = db_insert(:user)
    author = Repo.insert!(%Author{user_id: member_user.id})

    attrs = %{
      article_id: article.id,
      author_id: author.id,
      joined_at: DateTime.utc_now(:second),
      permissions: %{"article.read_draft" => true, "article.update" => true}
    }

    member = Repo.insert!(ArticleCoAuthor.changeset(%ArticleCoAuthor{}, attrs))

    assert {:ok, scope} = Passport.load_article_scope(member_user, article)
    assert scope.membership.member_id == member.id
    assert scope.membership.revision == 1
    assert {:ok, true} = Passport.allowed?(member_user, scope, "article.update")
    assert {:ok, false} = Passport.allowed?(member_user, scope, "article.publish")
    assert {:ok, false} = Passport.allowed?(member_user, scope, "article.author.manage")
    assert {:ok, owner_global} = Passport.load_global_scope(owner)

    assert {:ok, owner_query} =
             Passport.scope_articles(Article, owner, owner_global, "article.author.manage")

    assert article.id in Enum.map(Repo.all(owner_query), & &1.id)

    assert {:ok, global} = Passport.load_global_scope(member_user)

    assert {:error, :invalid_scope} =
             Passport.scope_articles(Author, member_user, global, "article.update")

    assert {:ok, query} = Passport.scope_articles(Article, member_user, global, "article.update")
    assert article.id in Enum.map(Repo.all(query), & &1.id)

    assert {:ok, query} =
             Passport.scope_articles(Article, member_user, global, "article.author.manage")

    refute article.id in Enum.map(Repo.all(query), & &1.id)
    assert {:ok, other_global} = Passport.load_global_scope(stranger)

    assert {:ok, query} =
             Passport.scope_articles(Article, stranger, other_global, "article.update")

    refute article.id in Enum.map(Repo.all(query), & &1.id)

    assert {:error, :invalid_scope} =
             Passport.scope_articles(Article, owner, global, "article.update")

    Repo.update_all(from(m in ArticleCoAuthor, where: m.id == ^member.id),
      set: [
        permissions: %{
          "article.read_draft" => true,
          "article.update" => true,
          "unknown.key" => true
        }
      ]
    )

    assert {:error, :unknown_action} = Passport.load_article_scope(member_user, article)
    assert {:ok, query} = Passport.scope_articles(Article, member_user, global, "article.update")
    refute article.id in Enum.map(Repo.all(query), & &1.id)

    for invalid_permissions <- [
          %{"article.read_draft" => "true", "article.update" => true},
          %{"article.read_draft" => false, "article.update" => true}
        ] do
      Repo.update_all(from(m in ArticleCoAuthor, where: m.id == ^member.id),
        set: [permissions: invalid_permissions]
      )

      assert {:error, _} = Passport.load_article_scope(member_user, article)

      assert {:ok, query} =
               Passport.scope_articles(Article, member_user, global, "article.update")

      refute article.id in Enum.map(Repo.all(query), & &1.id)
    end

    Repo.update_all(from(m in ArticleCoAuthor, where: m.id == ^member.id),
      set: [
        permissions: %{
          "article.read_draft" => true,
          "article.update" => true,
          "unknown.key" => true
        }
      ]
    )

    root_row = Repo.insert!(%CMS.Model.GlobalPassport{user_id: member_user.id, is_root: true})
    assert {:ok, root_scope} = Passport.load_global_scope(member_user)
    assert {:error, :unknown_action} = Passport.load_article_scope(member_user, article)

    assert {:ok, query} =
             Passport.scope_articles(Article, member_user, root_scope, "article.update")

    refute article.id in Enum.map(Repo.all(query), & &1.id)
    Repo.delete!(root_row)

    Repo.update_all(from(m in ArticleCoAuthor, where: m.id == ^member.id),
      set: [permissions: attrs.permissions]
    )

    grant_scope = %Passport.Scope.ArticleGrant{
      subject_id: member_user.id,
      article_id: article.id,
      member: member
    }

    assert {:error, :invalid_scope} =
             Passport.grant_in_transaction(stranger, grant_scope, %{"article.publish" => true}, 1)

    assert {:ok, {:ok, updated}} =
             Repo.transaction(fn ->
               Passport.grant_in_transaction(
                 member_user,
                 grant_scope,
                 %{"article.publish" => true},
                 1
               )
             end)

    assert updated.permissions["article.publish"]

    assert {:ok, {:error, :permission_revision_conflict}} =
             Repo.transaction(fn ->
               Passport.revoke_in_transaction(member_user, grant_scope, ["article.read_draft"], 1)
             end)

    assert {:ok, {:ok, revoked}} =
             Repo.transaction(fn ->
               Passport.revoke_in_transaction(
                 member_user,
                 %{grant_scope | member: updated},
                 ["article.read_draft"],
                 updated.revision
               )
             end)

    assert revoked.permissions == %{}

    invalid =
      ArticleCoAuthor.changeset(%ArticleCoAuthor{}, %{
        attrs
        | permissions: %{"article.update" => true}
      })

    refute invalid.valid?

    assert {:error, duplicate} =
             Repo.insert(ArticleCoAuthor.changeset(%ArticleCoAuthor{}, attrs), mode: :savepoint)

    assert Keyword.has_key?(duplicate.errors, :article_id)

    assert {:error, owner_member} =
             Repo.insert(
               ArticleCoAuthor.changeset(%ArticleCoAuthor{}, %{
                 attrs
                 | author_id: article.author_id
               }),
               mode: :savepoint
             )

    assert Keyword.has_key?(owner_member.errors, :author_id)
  end

  test "pending requests enforce one active subject and valid terminal state" do
    {_community, public, _, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)

    attrs = %{
      article_id: public.id,
      subject_user_id: subject.id,
      created_by_id: owner.id,
      type: :invite,
      proposed_permissions: %{"article.read_draft" => true},
      expires_at: DateTime.add(DateTime.utc_now(:second), 604_800, :second)
    }

    request = Repo.insert!(ArticleCoAuthorRequest.changeset(%ArticleCoAuthorRequest{}, attrs))

    assert {:error, _} =
             Repo.insert(
               ArticleCoAuthorRequest.changeset(%ArticleCoAuthorRequest{}, %{attrs | type: :apply}),
               mode: :savepoint
             )

    assert {:error, _} =
             Repo.update(ArticleCoAuthorRequest.changeset(request, %{status: :decided}),
               mode: :savepoint
             )

    assert {:error, _} =
             Repo.update(ArticleCoAuthorRequest.changeset(request, %{proposed_permissions: %{}}),
               mode: :savepoint
             )

    assert {:ok, decided} =
             Repo.update(
               ArticleCoAuthorRequest.changeset(request, %{
                 status: :decided,
                 decision: :reject,
                 decided_by_id: subject.id,
                 decided_at: DateTime.utc_now(:second)
               })
             )

    assert decided.status == :decided

    assert {:ok, _} =
             Repo.insert(
               ArticleCoAuthorRequest.changeset(%ArticleCoAuthorRequest{}, %{attrs | type: :apply})
             )
  end
end
