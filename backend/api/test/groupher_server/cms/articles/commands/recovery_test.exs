defmodule GroupherServer.Test.CMS.Articles.Commands.Recovery do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS

  test "create replay survives the Article entering Trash" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    attrs = mock_attrs(:post)
    command_id = Ecto.UUID.generate()

    assert {:ok, created} =
             CMS.Articles.create(community, :post, attrs, user, command_id: command_id)

    assert {:ok, _trash_item} = CMS.Articles.trash(created, user)

    assert {:ok, replayed} =
             CMS.Articles.create(community, :post, attrs, user, command_id: command_id)

    assert replayed.article_id == created.article_id
    assert replayed.id == created.id
  end

  test "update replay returns the canonical published result" do
    {_community, public, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    attrs = %{
      title: "Updated through a command",
      expected_version: public.version
    }

    assert {:ok, published} = CMS.Articles.update(public, attrs, user, command_id)

    assert {:ok, replayed} = CMS.Articles.update(public, attrs, user, command_id)
    assert replayed.id == published.id
    assert replayed.stage == :public
    assert replayed.title == "Updated through a command"
  end

  test "publish replay returns the committed stable result" do
    {_community, public, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    lifecycle =
      GroupherServer.Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: public.article_id)

    article = GroupherServer.Repo.get!(CMS.Model.Article, public.article_id)
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)
    assert {:ok, _draft} = CMS.Articles.Draft.Store.ensure_from_public(article, author)

    assert {:ok, draft} =
             CMS.Articles.update_draft(
               public.article_id,
               %{title: "Published through a command"},
               user,
               expected_version: public.version
             )

    opts = [
      expected_draft_version: draft.version,
      expected_lifecycle_version: lifecycle.version,
      command_id: command_id
    ]

    assert {:ok, published} = CMS.Articles.publish(public.article_id, user, opts)
    assert {:ok, replayed} = CMS.Articles.publish(public.article_id, user, opts)
    assert replayed.article.id == published.article.id
    assert replayed.public.revision_id == published.public.revision_id
  end
end
