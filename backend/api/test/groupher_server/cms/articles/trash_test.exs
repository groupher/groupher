defmodule GroupherServer.Test.CMS.Articles.Trash do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Activity, AlertWall, CMS}
  alias AlertWall.Model.{Item, UserReport}

  alias CMS.Model.{
    ArticleEmotionCount,
    ArticleLifecycle,
    ArticleStats,
    ArtimentMention,
    Comment,
    TrashAction,
    TrashedArticle
  }

  alias Activity.Model.PostLog

  @site_host CMS.ArtimentMentions.Config.site_host()

  test "Trash hides, lists and restores one logical Article without deleting content" do
    {community, post, _attrs, user} = mock_article(:post)
    post_id = post.id

    assert {:ok, %TrashedArticle{} = item} = CMS.Articles.trash(post, user)
    assert Repo.get(CMS.Model.Article, post_id)
    assert CMS.Articles.Trash.trashed_article?(post)

    assert {:error, _} = read_article(community, :post, article_inner_id(post, community))

    assert {:ok, %{entries: []}} =
             CMS.Articles.page(
               :post,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}
             )

    assert {:ok, %{entries: [%TrashedArticle{hash_id: trash_ref}]}} =
             CMS.Articles.list_trashed(
               community,
               %{thread: :post},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )

    assert trash_ref == item.hash_id
    action = Repo.get!(TrashAction, item.trash_action_id)
    assert Repo.get_by(PostLog, action: :trashed, operation_ref: action.hash_id)

    assert {:ok, restored} = CMS.Articles.restore_trashed(item.hash_id, user)
    assert restored.id == post.id
    assert {:ok, _} = read_article(community, :post, article_inner_id(post, community))
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    refute Repo.get(TrashAction, item.trash_action_id)
  end

  test "restore receipt replays after the Trash membership is gone" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    command_id = Ecto.UUID.generate()
    opts = [command_id: command_id, community_id: community.id, thread: :post]

    assert {:ok, first} = CMS.Articles.restore_trashed_receipt(item.hash_id, user, opts)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    assert {:ok, replayed} = CMS.Articles.restore_trashed_receipt(item.hash_id, user, opts)
    assert replayed == first
    assert replayed.command_id == command_id
  end

  test "restore scope validation is owned by the command use case" do
    {community, post, _attrs, user} = mock_article(:post)
    {:ok, other_community} = mock_community(user)
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:error, _reason} =
             CMS.Articles.restore_trashed(item.hash_id, user,
               command_id: Ecto.UUID.generate(),
               community_id: other_community.id,
               thread: :post
             )

    assert {:error, _reason} =
             CMS.Articles.restore_trashed(item.hash_id, user,
               command_id: Ecto.UUID.generate(),
               community_id: community.id,
               thread: :blog
             )

    assert Repo.get_by(TrashedArticle, hash_id: item.hash_id)
  end

  test "Trash excludes Posts from scalar, grouped and multi-status Kanban lists" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, post} = CMS.Articles.set_status(post.id, :todo, user, community.id)

    assert {:ok, %{entries: [listed]}} =
             CMS.Articles.kanban_page(
               community,
               %{status: :todo},
               %GroupherServer.Pagi.Params.Offset{
                 page: 1,
                 size: 20,
                 config_revision: 0
               }
             )

    assert listed.id == post.id

    assert {:ok, %{entries: [listed]}} =
             CMS.Articles.kanban_page(
               community,
               %{statuses: [:todo, :wip]},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}
             )

    assert listed.id == post.id
    assert {:ok, %{todo: %{entries: [listed]}}} = CMS.Articles.grouped_kanban(community)
    assert listed.id == post.id

    assert {:ok, _item} = CMS.Articles.trash(post, user, community: community)

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Articles.kanban_page(
               community,
               %{status: :todo},
               %GroupherServer.Pagi.Params.Offset{
                 page: 1,
                 size: 20,
                 config_revision: 0
               }
             )

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Articles.kanban_page(
               community,
               %{statuses: [:todo, :wip]},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}
             )

    assert {:ok, %{todo: %{entries: [], page_info: %{total_count: 0}}}} =
             CMS.Articles.grouped_kanban(community)
  end

  test "Trash excludes Articles from an author's published list and count" do
    {community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{entries: entries}} =
             CMS.Articles.paged_published(
               :post,
               %{},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
               user
             )

    assert Enum.any?(entries, &(&1.id == post.id))
    assert {:ok, count_before} = CMS.Articles.count_published(:post, user)

    assert {:ok, _item} = CMS.Articles.trash(post, user, community: community)

    assert {:ok, %{entries: entries}} =
             CMS.Articles.paged_published(
               :post,
               %{},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
               user
             )

    refute Enum.any?(entries, &(&1.id == post.id))
    assert {:ok, count_after} = CMS.Articles.count_published(:post, user)
    assert count_after == count_before - 1
  end

  test "permanent delete removes the aggregate but keeps append-only audit" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)
    refute Repo.get(CMS.Model.Article, post.article_id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)

    refute Repo.get_by(ArticleLifecycle,
             community_id: community.id,
             thread: :post,
             article_id: post.article_id
           )

    assert Repo.get_by(PostLog,
             action: :permanently_deleted,
             article_id: post.article_id
           )

    assert {:ok, %{entries: []}} =
             CMS.Articles.list_trashed(
               community,
               %{thread: :post},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )
  end

  test "permanent delete supersedes Wall items and preserves report history" do
    {_community, post, _attrs, user} = mock_article(:post)

    report_attrs = %{
      reporter_id: user.id,
      owner: :cms,
      target_type: :article,
      target_id: to_string(post.article_id),
      community_id: nil,
      subject_ref: "published-subject",
      report_type: "SPAM",
      details: "Please review"
    }

    assert {:ok, {item, report}} =
             Repo.transact_result(fn ->
               with {:ok, report} <-
                      AlertWall.submit_report_in_transaction(
                        report_attrs,
                        Ecto.UUID.generate()
                      ),
                    %Item{} = item <- Repo.get(Item, report.item_id) do
                 {:ok, {item, report}}
               else
                 {:error, reason} -> {:error, reason}
                 _ -> {:error, :wall_item_not_found}
               end
             end)

    assert {:ok, trash_item} = CMS.Articles.trash(post, user)

    assert {:ok, %{done: true}} =
             CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

    deleted_item = Repo.get!(Item, item.id)
    assert deleted_item.target_id == to_string(post.article_id)
    assert deleted_item.target_deleted_at
    assert deleted_item.status == :superseded

    deleted_report = Repo.get!(UserReport, report.id)
    assert deleted_report.target_id == to_string(post.article_id)
    assert deleted_report.item_id == item.id
    assert deleted_report.outdated_at
  end

  test "permanent-delete receipt replays after the aggregate is gone" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    command_id = Ecto.UUID.generate()
    opts = [command_id: command_id, community_id: community.id, thread: :post]

    assert {:ok, %{done: true, command_id: ^command_id} = first} =
             CMS.Articles.permanently_delete_trashed_receipt(item.hash_id, user, opts)

    refute Repo.get(CMS.Model.Article, post.article_id)

    assert {:ok, replayed} =
             CMS.Articles.permanently_delete_trashed_receipt(item.hash_id, user, opts)

    assert replayed == first
  end

  test "permanent delete rejects a stale emotion request and leaves no orphan projections" do
    {_community, post, _attrs, user} = mock_article(:post)
    {:ok, other_user} = db_insert(:user)

    assert {:ok, _} = CMS.Interactions.emotion(post, :heart, other_user, Ecto.UUID.generate())
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:error, _reason} =
             CMS.Interactions.emotion(post, :beer, other_user, Ecto.UUID.generate())

    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)

    refute Repo.get(CMS.Model.Article, post.article_id)
    refute Repo.get_by(ArticleStats, thread: :post, article_id: post.article_id)
    refute Repo.get_by(ArticleEmotionCount, thread: :post, article_id: post.article_id)
  end

  test "permanent delete removes comment-owned Mention facts before comments cascade" do
    {community, post, _attrs, user} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, user)

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "comment-mention",
          "children" => [
            %{"text" => ~s(<a href="#{@site_host}/blog/#{target.id}">target</a>)}
          ]
        }
      ])

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(post, community),
               mock_body_bag(body),
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, {1, nil}} = CMS.ArtimentMentions.sync(comment)
    assert Repo.get_by(ArtimentMention, mentioner_type: :comment, mentioner_id: comment.id)

    assert {:ok, item} = CMS.Articles.trash(post, user)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)

    refute Repo.get(Comment, comment.id)
    refute Repo.get_by(ArtimentMention, mentioner_type: :comment, mentioner_id: comment.id)
  end

  test "Mention badges follow Trash, restore and permanent deletion while incoming facts remain" do
    {community, target, _attrs, user} = mock_article(:post)
    {_, mentioner, _, _} = mock_article(:blog, community, user)

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "mention-target",
          "children" => [
            %{"text" => ~s(<a href="#{@site_host}/post/#{target.id}">target</a>)}
          ]
        }
      ])

    assert {:ok, mentioner} =
             CMS.Articles.update(
               mentioner,
               %{
                 body_bag: mock_body_bag(body),
                 expected_version: mentioner.version
               },
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, {1, nil}} = CMS.ArtimentMentions.sync(mentioner)

    assert {:ok, item} = CMS.Articles.trash(target, user)

    mention =
      Repo.get_by!(ArtimentMention,
        mentioned_type: :post,
        mentioned_article_id: target.article_id
      )

    assert mention.mentioned_snapshot["deletionState"] == "trashed"
    assert mention.meta["mentionedDeleted"]

    assert {:ok, %{entries: [listed]}} =
             CMS.Articles.list_trashed(
               community,
               %{thread: :post},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )

    assert listed.mentioned_by_count == 1

    assert {:ok, %{total_count: 1}} =
             CMS.ArtimentMentions.mentioned_by(
               :post,
               listed.article.id,
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )

    assert {:ok, _} = CMS.Articles.restore_trashed(item.hash_id, user)
    mention = Repo.get!(ArtimentMention, mention.id)
    refute Map.has_key?(mention.mentioned_snapshot, "deletionState")
    refute Map.has_key?(mention.meta, "mentionedDeleted")

    assert {:ok, item} = CMS.Articles.trash(target, user)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item.hash_id, user)

    mention = Repo.get!(ArtimentMention, mention.id)
    assert mention.mentioned_snapshot["deletionState"] == "permanently_deleted"
    assert mention.meta["mentionedDeleted"]
    refute mention.meta["mentionedTrashed"]
  end

  test "scheduler permanently deletes due actions and records a system audit" do
    {_community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user, retention_days: 0)

    assert {:ok, %{deleted: 1, failed: []}} =
             CMS.Trash.purge_due(now: DateTime.utc_now(:second), size: 10)

    refute Repo.get(CMS.Model.Article, post.article_id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)

    assert Repo.get_by(PostLog,
             action: :permanently_deleted,
             article_id: post.article_id,
             source: :scheduler
           )
  end

  test "scoped Trash permanent delete uses the Article receipt command" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)
    action = Repo.get!(TrashAction, item.trash_action_id)
    command_id = Ecto.UUID.generate()

    assert {:ok, %{done: true, command_id: ^command_id}} =
             CMS.Trash.permanently_delete_action_in_scope(
               action.hash_id,
               community.id,
               :post,
               user,
               command_id: command_id
             )

    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    refute Repo.get(TrashAction, item.trash_action_id)
  end

  test "standalone Doc Trash is rejected so Tree placement cannot become dangling" do
    {_community, doc, _attrs, user} = mock_article(:doc)

    assert {:error, %ErrorCat.Error{reason: :custom, details: message}} =
             CMS.Articles.trash(doc, user)

    assert message =~ "Docs Tree lifecycle"
  end

  test "Trash and restore update community counters for ordinary Article threads" do
    Enum.each([:post, :blog, :changelog], fn thread ->
      {community, article, _attrs, user} = mock_article(thread)
      count_field = String.to_existing_atom("#{thread}s_count")

      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 1

      assert {:ok, item} = CMS.Articles.trash(article, user)
      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 0

      assert {:ok, _} = CMS.Articles.restore_trashed(item.hash_id, user)
      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 1
    end)
  end
end
