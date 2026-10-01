defmodule GroupherServer.Test.CMS.DocArchive do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Articles.Draft.Store
  alias CMS.Model.{DocLifecycle, DocPublic}

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)
    {:ok, branch} = CMS.Docs.Branch.resolve(community, [])

    {:ok, %{article: article, draft: draft}} =
      Store.create(
        community,
        :doc,
        %{
          title: "Archived Doc",
          slug: "archived-doc",
          subtitle: "archive boundary",
          body_bag: mock_body_bag(mock_rich_text("archived body"))
        },
        author,
        branch_id: branch.id
      )

    {:ok, _published} =
      CMS.Docs.publish_branch(article.id, branch.id, user,
        expected_draft_version: draft.version,
        expected_lifecycle_version: 1
      )

    public = Repo.get_by!(DocPublic, article_id: article.id, branch_id: branch.id)

    public
    |> Ecto.Changeset.change(inserted_at: @last_year)
    |> Repo.update!()

    {:ok, ~m(user community branch article)a}
  end

  test "archives old stable Doc public heads per branch", ~m(branch article)a do
    assert {:ok, 1} = CMS.Articles.archive(:doc)

    assert Repo.get_by!(DocLifecycle, article_id: article.id, branch_id: branch.id).state ==
             :archived
  end

  test "an archived stable Doc cannot re-enter draft editing", ~m(user branch article)a do
    assert {:ok, 1} = CMS.Articles.archive(:doc)

    assert {:error, _reason} =
             CMS.Docs.update_draft(
               article.id,
               branch.id,
               %{title: "new title", expected_version: 1},
               user
             )
  end

  test "an archived stable Doc cannot enter branch Trash", ~m(user community branch article)a do
    assert {:ok, 1} = CMS.Articles.archive(:doc)

    {:ok, action} =
      CMS.Docs.Trash.create_action(community, user, %{
        root_type: "doc_tree_page",
        root_ref: "archive-test"
      })

    assert {:error, _reason} =
             CMS.Docs.Trash.attach(action, community, branch, article.id, user)
  end
end
