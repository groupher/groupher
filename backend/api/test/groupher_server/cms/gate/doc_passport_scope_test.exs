defmodule GroupherServer.Test.CMS.Gate.DocPassportScope do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Gate.Access.Policy.Article, as: ArticlePolicy
  alias CMS.Gate.Context.Access.Article, as: ArticleContext
  alias CMS.Gate.Context.Access.Doc, as: DocContext
  alias CMS.Model.{ArticleLifecycle, CommunityLifecycle}

  test "Doc mutations use Doc queue grants while ordinary Articles stay Article scoped" do
    {:ok, owner} = db_insert(:user)
    {:ok, editor} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    community_lifecycle = Repo.get_by!(CommunityLifecycle, community_id: community.id)
    community = %{community | lifecycle: community_lifecycle}

    doc = %{
      id: Ecto.UUID.generate(),
      community_id: community.id,
      thread: :doc,
      author_id: owner.id,
      author: %{user_id: owner.id}
    }

    doc_context = %DocContext{
      doc: doc,
      doc_lifecycle: %ArticleLifecycle{state: :published},
      community: community,
      community_lifecycle: community_lifecycle,
      community_passport_scope:
        community_passport_scope(editor, community, %{
          "doc.queue.write" => true
        })
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(editor, :edit, doc_context)

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(editor, :publish, doc_context)

    doc_context = %{
      doc_context
      | community_passport_scope:
          community_passport_scope(editor, community, %{
            "doc.queue.write" => true,
            "doc.queue.publish" => true
          })
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(editor, :publish, doc_context)

    article = %{
      id: Ecto.UUID.generate(),
      community_id: community.id,
      thread: :post,
      author_id: owner.id,
      author: %{user_id: owner.id},
      meta: %{is_comment_locked: false}
    }

    editor_article_context = %ArticleContext{
      article: article,
      article_lifecycle: %ArticleLifecycle{state: :published},
      community: community,
      community_lifecycle: community_lifecycle,
      article_passport_scope: article_passport_scope(editor, article)
    }

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             ArticlePolicy.check_access(editor, :edit, editor_article_context)

    owner_article_context = %{
      editor_article_context
      | article_passport_scope: article_passport_scope(owner, article)
    }

    assert {:ok, :pass} = ArticlePolicy.check_access(owner, :edit, owner_article_context)
  end

  defp community_passport_scope(actor, community, permissions) do
    %GroupherServer.CMS.Passport.Scope.Community{
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

  defp article_passport_scope(actor, article) do
    %GroupherServer.CMS.Passport.Scope.Article{
      actor_id: actor.id,
      article_id: article.id,
      owner_user_id: article.author.user_id,
      global: %{is_root: false, permissions: %{}},
      membership: nil
    }
  end
end
