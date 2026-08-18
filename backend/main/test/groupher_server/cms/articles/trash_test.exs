defmodule GroupherServer.Test.CMS.Articles.Trash do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias CMS.Model.{
    ArticleLifecycle,
    ArtimentMention,
    AuditLog,
    Comment,
    Post,
    TrashAction,
    TrashedArticle
  }

  @site_host GroupherServer.CMS.ArtimentMentions.Config.site_host()

  test "Trash hides, lists and restores one logical Article without deleting content" do
    {community, post, _attrs, user} = mock_article(:post)
    post_id = post.id

    assert {:ok, %TrashedArticle{} = item} = CMS.Articles.trash(post, user)
    assert Repo.get(Post, post_id)
    assert CMS.Articles.Trash.trashed?(community, :post, post.article_hash_id)

    assert {:error, _} = CMS.Articles.read(community, :post, post.inner_id)

    assert {:ok, %{entries: []}} =
             CMS.Articles.page(:post, %{community: community.slug, page: 1, size: 20})

    assert {:ok, %{entries: [%TrashedArticle{hash_id: trash_ref}]}} =
             CMS.Articles.list_trashed(community, %{thread: :post, page: 1, size: 20})

    assert trash_ref == item.hash_id
    action = Repo.get!(TrashAction, item.trash_action_id)
    assert Repo.get_by(AuditLog, action: "article.trashed", operation_ref: action.hash_id)

    assert {:ok, restored} = CMS.Articles.restore_trashed(item, user)
    assert restored.article_hash_id == post.article_hash_id
    assert {:ok, _} = CMS.Articles.read(community, :post, post.inner_id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)
    refute Repo.get(TrashAction, item.trash_action_id)
  end

  test "Trash excludes Posts from scalar, grouped and multi-status Kanban lists" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, post} = CMS.Articles.set_status(post, :todo)

    assert {:ok, %{entries: [listed]}} =
             CMS.Articles.paged_kanban(community, %{status: :todo, page: 1, size: 20})

    assert listed.id == post.id

    assert {:ok, %{entries: [listed]}} =
             CMS.Articles.paged_kanban(community, %{
               status: [:todo, :wip],
               page: 1,
               size: 20
             })

    assert listed.id == post.id
    assert {:ok, %{todo: %{entries: [listed]}}} = CMS.Articles.grouped_kanban(community)
    assert listed.id == post.id

    assert {:ok, _item} = CMS.Articles.trash(post, user)

    assert {:ok, %{entries: [], total_count: 0}} =
             CMS.Articles.paged_kanban(community, %{status: :todo, page: 1, size: 20})

    assert {:ok, %{entries: [], total_count: 0}} =
             CMS.Articles.paged_kanban(community, %{
               status: [:todo, :wip],
               page: 1,
               size: 20
             })

    assert {:ok, %{todo: %{entries: [], total_count: 0}}} =
             CMS.Articles.grouped_kanban(community)
  end

  test "Trash excludes Articles from an author's published list and count" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{entries: entries}} =
             CMS.Articles.paged_published(:post, %{page: 1, size: 20}, user)

    assert Enum.any?(entries, &(&1.id == post.id))
    assert {:ok, count_before} = CMS.Articles.count_published(:post, user)

    assert {:ok, _item} = CMS.Articles.trash(post, user)

    assert {:ok, %{entries: entries}} =
             CMS.Articles.paged_published(:post, %{page: 1, size: 20}, user)

    refute Enum.any?(entries, &(&1.id == post.id))
    assert {:ok, count_after} = CMS.Articles.count_published(:post, user)
    assert count_after == count_before - 1
  end

  test "Trash excludes Articles from the audit-failed list" do
    {_community, post, _attrs, user} = mock_article(:post)
    assert {:ok, post} = CMS.Articles.set_audit_failed(post, %{})

    assert {:ok, %{entries: entries}} =
             CMS.Articles.paged_audit_failed(:post, %{page: 1, size: 20})

    assert Enum.any?(entries, &(&1.id == post.id))

    assert {:ok, _item} = CMS.Articles.trash(post, user)

    assert {:ok, %{entries: entries}} =
             CMS.Articles.paged_audit_failed(:post, %{page: 1, size: 20})

    refute Enum.any?(entries, &(&1.id == post.id))
  end

  test "permanent delete removes the aggregate but keeps append-only audit" do
    {community, post, _attrs, user} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, user)

    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item, user)
    refute Repo.get(Post, post.id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)

    refute Repo.get_by(ArticleLifecycle,
             community_id: community.id,
             thread: :post,
             article_hash_id: post.article_hash_id
           )

    assert Repo.get_by(AuditLog,
             action: "article.permanently_deleted",
             resource_ref: post.article_hash_id
           )

    assert {:ok, %{entries: []}} =
             CMS.Articles.list_trashed(community, %{thread: :post, page: 1, size: 20})
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
             CMS.Comments.create_comment(community, :post, post.inner_id, body, user)

    assert {:ok, {1, nil}} = CMS.ArtimentMentions.sync(comment)
    assert Repo.get_by(ArtimentMention, mentioner_type: :comment, mentioner_id: comment.id)

    assert {:ok, item} = CMS.Articles.trash(post, user)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item, user)

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

    assert {:ok, mentioner} = CMS.Articles.update(mentioner, %{body_bag: mock_body_bag(body)})
    assert {:ok, {1, nil}} = CMS.ArtimentMentions.sync(mentioner)

    assert {:ok, item} = CMS.Articles.trash(target, user)
    mention = Repo.get_by!(ArtimentMention, mentioned_type: :post, mentioned_id: target.id)
    assert mention.mentioned_snapshot["deletionState"] == "trashed"
    assert mention.meta["mentionedDeleted"]

    assert {:ok, %{entries: [listed]}} =
             CMS.Articles.list_trashed(community, %{thread: :post, page: 1, size: 20})

    assert listed.mentioned_by_count == 1

    assert {:ok, %{total_count: 1}} =
             CMS.ArtimentMentions.mentioned_by(:post, listed.article.id, %{
               page: 1,
               size: 20
             })

    assert {:ok, _} = CMS.Articles.restore_trashed(item, user)
    mention = Repo.get!(ArtimentMention, mention.id)
    refute Map.has_key?(mention.mentioned_snapshot, "deletionState")
    refute Map.has_key?(mention.meta, "mentionedDeleted")

    assert {:ok, item} = CMS.Articles.trash(target, user)
    assert {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(item, user)

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

    refute Repo.get(Post, post.id)
    refute Repo.get_by(TrashedArticle, hash_id: item.hash_id)

    assert Repo.get_by(AuditLog,
             action: "article.permanently_deleted",
             resource_ref: post.article_hash_id,
             source: "scheduler"
           )
  end

  test "standalone Doc Trash is rejected so Tree placement cannot become dangling" do
    {_community, doc, _attrs, user} = mock_article(:doc)

    assert {:error, {:custom, message}} = CMS.Articles.trash(doc, user)
    assert message =~ "Docs Tree lifecycle"
  end

  test "Trash and restore update community counters for ordinary Article threads" do
    Enum.each([:post, :blog, :changelog], fn thread ->
      {community, article, _attrs, user} = mock_article(thread)
      count_field = String.to_existing_atom("#{thread}s_count")

      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 1

      assert {:ok, item} = CMS.Articles.trash(article, user)
      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 0

      assert {:ok, _} = CMS.Articles.restore_trashed(item, user)
      assert Repo.get!(CMS.Model.Community, community.id).meta |> Map.fetch!(count_field) == 1
    end)
  end
end
