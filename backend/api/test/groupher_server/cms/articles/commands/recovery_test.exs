defmodule GroupherServer.Test.CMS.Articles.Commands.Recovery do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticlePublic, ArticleSnapshot, ArticleWorkingCopy}

  test "createArticle replay returns its original default WorkingCopy" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    command_id = Ecto.UUID.generate()

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "Draft Article", body_bag: mock_body_bag(mock_rich_text("draft"))},
               user,
               command_id: command_id
             )

    assert {:ok, %{article: replayed_article, working_copy: replayed_work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "Draft Article", body_bag: mock_body_bag(mock_rich_text("draft"))},
               user,
               command_id: command_id
             )

    assert replayed_article.id == article.id
    assert replayed_work.id == work.id
    assert replayed_work.revision == 1
  end

  test "createAndPublishArticle retry returns its original Snapshot" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    command_id = Ecto.UUID.generate()
    attrs = %{title: "Published Article", body_bag: mock_body_bag(mock_rich_text("body"))}

    assert {:ok, %{article: article, snapshot: snapshot}} =
             CMS.Articles.create_and_publish_article(
               community,
               :post,
               attrs,
               user,
               command_id: command_id
             )

    assert {:ok, %{article: replayed_article, snapshot: replayed_snapshot}} =
             CMS.Articles.create_and_publish_article(
               community,
               :post,
               attrs,
               user,
               command_id: command_id
             )

    assert replayed_article.id == article.id
    assert replayed_snapshot.id == snapshot.id
    assert Repo.get!(ArticlePublic, article.id).snapshot_id == snapshot.id
  end

  test "saveWorkingCopy retries preserve the confirmed revision" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Saved title"},
               work.revision,
               user,
               command_id
             )

    assert {:ok, replayed} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Saved title"},
               work.revision,
               user,
               command_id
             )

    assert replayed.id == saved.id
    assert replayed.revision == saved.revision
    assert replayed.title == "Saved title"
  end

  test "publishArticle retries return the selected Snapshot" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(Article, public.article_id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    current = Repo.get!(ArticlePublic, article.id)
    command_id = Ecto.UUID.generate()
    source = %{working_copy_id: work.id, revision: work.revision}

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      user,
      minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
    )

    assert {:ok, %{snapshot: snapshot}} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               current.snapshot_id,
               user,
               command_id
             )

    assert {:ok, %{snapshot: replayed_snapshot}} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               current.snapshot_id,
               user,
               command_id
             )

    assert replayed_snapshot.id == snapshot.id
    assert Repo.get!(ArticleSnapshot, snapshot.id).title == snapshot.title
  end
end
