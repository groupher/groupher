defmodule GroupherServer.Test.CMS.Articles.OperationEffectsTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{Activity, CMS}
  alias Activity.Model.PostLog
  alias CMS.Model.{Article, ArticleLifecycle, ArticlePublic, ArticleWorkingCopy, CommunityAdmin}
  alias CMS.Outbox.Event

  test "B to C to B registers a new projection for every publication and replay adds none" do
    {community, view, _, actor} = mock_article(:post)
    article = Repo.get!(Article, view.id)
    first = Repo.get!(ArticlePublic, article.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id, scope_type: :default)

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               work.id,
               %{title: "Selected version C"},
               work.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Articles.publish_article(
               article,
               community,
               %{working_copy_id: work.id, revision: saved.revision},
               first.snapshot_id,
               actor,
               Ecto.UUID.generate()
             )

    middle = Repo.get!(ArticlePublic, article.id)
    refute middle.snapshot_id == first.snapshot_id
    command_id = Ecto.UUID.generate()
    source = %{snapshot_id: first.snapshot_id}

    assert {:ok, _} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               middle.snapshot_id,
               actor,
               command_id
             )

    assert Repo.get!(ArticlePublic, article.id).snapshot_id == first.snapshot_id
    projections = events(article.id, "article.projections")
    assert length(projections) == 3
    assert projections |> Enum.map(& &1.operation_ref) |> Enum.uniq() |> length() == 3
    assert projections |> Enum.map(& &1.dedupe_key) |> Enum.uniq() |> length() == 3

    assert {:ok, _} =
             CMS.Articles.publish_article(
               article,
               community,
               source,
               middle.snapshot_id,
               actor,
               command_id
             )

    assert Enum.map(events(article.id, "article.projections"), & &1.id) ==
             Enum.map(projections, & &1.id)

    assert length(events(article.id, "article.first_published_notification")) == 1
  end

  test "recreating a Public projection preserves the first publication and frozen notification" do
    {community, view, _, actor} = mock_article(:post)
    article = Repo.get!(Article, view.id)
    public = Repo.get!(ArticlePublic, article.id)
    first_published_at = Repo.get_by!(ArticleLifecycle, article_id: article.id).first_published_at
    assert first_published_at
    assert [original] = events(article.id, "article.first_published_notification")
    {:ok, next_admin} = db_insert(:user)
    Repo.insert!(%CommunityAdmin{community_id: community.id, user_id: next_admin.id})

    assert {:ok, {:ok, _}} =
             Repo.transaction(fn ->
               Repo.delete!(public)

               CMS.Articles.publish_article(
                 article,
                 community,
                 %{snapshot_id: public.snapshot_id},
                 nil,
                 actor,
                 Ecto.UUID.generate()
               )
             end)

    assert Repo.get!(ArticlePublic, article.id).snapshot_id == public.snapshot_id

    assert Repo.get_by!(ArticleLifecycle, article_id: article.id).first_published_at ==
             first_published_at

    assert [notification] = events(article.id, "article.first_published_notification")
    assert notification.id == original.id
    assert notification.data == original.data
    refute next_admin.id in notification.data["notify_user_ids"]

    assert Repo.aggregate(
             from(log in PostLog,
               where: log.article_id == ^article.id and log.action == :created
             ),
             :count
           ) == 1
  end

  defp events(article_id, event) do
    Repo.all(
      from(row in Event,
        where: row.resource_id == ^article_id and row.event == ^event,
        order_by: [asc: row.inserted_at, asc: row.id]
      )
    )
  end
end
