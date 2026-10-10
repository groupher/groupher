defmodule GroupherServer.Test.CMS.Articles.Commands.Recovery do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

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

  test "create result shape is stable with or without commandId" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    attrs = mock_attrs(:post)

    assert {:ok, direct} = CMS.Articles.create(community, :post, attrs, user)

    assert {:ok, commanded} =
             CMS.Articles.create(community, :post, attrs, user, command_id: Ecto.UUID.generate())

    assert Map.keys(Map.delete(direct, :command_id)) |> Enum.sort() ==
             Map.keys(Map.delete(commanded, :command_id)) |> Enum.sort()
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
    {community, public, _attrs, user} = mock_article(:post)
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
               expected_version: public.version,
               community: community
             )

    opts = [
      expected_draft_version: draft.version,
      expected_lifecycle_version: lifecycle.version,
      community: community,
      command_id: command_id
    ]

    events_before = Repo.aggregate(CMS.Outbox.Event, :count)
    assert {:ok, published} = CMS.Articles.publish(public.article_id, user, opts)
    assert Repo.aggregate(CMS.Outbox.Event, :count) == events_before + 2

    assert Repo.all(from(event in CMS.Outbox.Event, where: event.command_id == ^command_id))
           |> Enum.map(& &1.event)
           |> Enum.sort() ==
             ["article.projections", "article.updated"]

    first_revision_id = published.public.revision_id

    {:ok, article_after_first} = CMS.FrontDesk.article(public.article_id, mode: :internal)
    {:ok, author} = CMS.Articles.Writer.ensure_author_exists(user)
    {:ok, draft_b} = CMS.Articles.Draft.Store.ensure_from_public(article_after_first, author)

    assert {:ok, draft_b} =
             CMS.Articles.update_draft(
               public.article_id,
               %{title: "Published through command B"},
               user,
               expected_version: draft_b.version,
               community: community
             )

    lifecycle_b =
      GroupherServer.Repo.get_by!(CMS.Model.ArticleLifecycle, article_id: public.article_id)

    opts_b = [
      expected_draft_version: draft_b.version,
      expected_lifecycle_version: lifecycle_b.version,
      community: community,
      command_id: Ecto.UUID.generate()
    ]

    assert {:ok, published_b} = CMS.Articles.publish(public.article_id, user, opts_b)
    assert published_b.public.revision_id != first_revision_id
    assert Repo.aggregate(CMS.Outbox.Event, :count) == events_before + 4

    assert {:ok, replayed} = CMS.Articles.publish(public.article_id, user, opts)
    assert Repo.aggregate(CMS.Outbox.Event, :count) == events_before + 4
    assert replayed.article.id == published.article.id
    assert replayed.revision_id == first_revision_id
    assert replayed.public.revision_id == first_revision_id
  end
end
