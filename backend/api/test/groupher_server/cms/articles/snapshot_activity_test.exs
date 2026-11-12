defmodule GroupherServer.Test.CMS.Articles.SnapshotActivityTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  alias GroupherServer.{Activity, CMS, Repo}
  alias Activity.Model.PostLog
  alias CMS.Model.{Article, ArticlePublic, ArticleWorkingCopy}

  test "first publication of an existing WorkingCopy records creation once" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(actor)

    body =
      mock_body_bag(Jason.encode!([%{"type" => "p", "children" => [%{"text" => "first body"}]}]))

    assert {:ok, %{article: article, working_copy: work}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "First publication", body_bag: body},
               actor,
               command_id: Ecto.UUID.generate()
             )

    command_id = Ecto.UUID.generate()
    source = %{working_copy_id: work.id, revision: work.revision}

    assert {:ok, %{public: public}} =
             CMS.Articles.publish_article(article, community, source, nil, actor, command_id)

    assert {:ok, _} =
             CMS.Articles.publish_article(article, community, source, nil, actor, command_id)

    assert [log] =
             Repo.all(
               from(log in PostLog,
                 where: log.article_id == ^article.id and log.action == :created
               )
             )

    assert log.metadata["snapshot_id"] == public.snapshot_id
  end

  test "republishing records the selected Snapshot changes once" do
    {community, post, _, actor} = mock_article(:post)
    article = Repo.get!(Article, post.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_kind: :default)
    original = Repo.get!(ArticlePublic, post.id)

    created =
      Repo.one!(
        from(log in PostLog, where: log.article_id == ^article.id and log.action == :created)
      )

    assert created.metadata["snapshot_id"] == original.snapshot_id

    body =
      mock_body_bag(
        Jason.encode!([%{"type" => "p", "children" => [%{"text" => "updated body"}]}])
      )

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Updated title", body_bag: body},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    command_id = Ecto.UUID.generate()
    source = %{working_copy_id: work.id, revision: saved.revision}

    assert {:ok, %{public: public}} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               original.snapshot_id,
               actor,
               command_id
             )

    assert {:ok, _} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               original.snapshot_id,
               actor,
               command_id
             )

    assert {:error, _} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               original.snapshot_id,
               actor,
               Ecto.UUID.generate()
             )

    logs =
      Repo.all(
        from(log in PostLog,
          where: log.article_id == ^article.id and log.action in [:title_changed, :body_updated]
        )
      )

    assert Enum.sort(Enum.map(logs, & &1.action)) == [:body_updated, :title_changed]
    assert Enum.all?(logs, &(&1.metadata["snapshot_id"] == public.snapshot_id))
    assert Enum.sort(Enum.map(logs, & &1.operation_index)) == [0, 1]
    assert Enum.find(logs, &(&1.action == :title_changed)).payload["title"] == "Updated title"
    assert Enum.find(logs, &(&1.action == :body_updated)).changed_fields == ["body"]
  end
end
