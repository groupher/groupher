defmodule GroupherServer.Test.CMS.Articles.BindingsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Accounts, Analysis, CMS, Repo}
  alias Accounts.Model.{CollectFolderEntry, Embeds}
  alias Analysis.Aggregator
  alias Analysis.Model.{ArticleHourlyMetric, MetricEvent}
  alias CMS.Articles.{BindingPersist, Bindings}
  alias CMS.Articles.Commands.BindingSupport
  alias CMS.ArtimentMentions.MentionsGraph.Revision, as: Revision
  alias CMS.Articles.Bindings.Tags
  alias CMS.Model.{Article, ArticleBinding, ArticleBindingTag, ArticleHistoryOwner}

  test "moving an Article preserves source history ownership and records the destination",
       ~m(community destination post)a do
    article = Repo.get!(Article, post.id)

    assert {:ok, _} =
             Repo.transact(fn -> BindingPersist.move(article, community, destination) end)

    assert Repo.get_by!(ArticleHistoryOwner,
             article_id: article.id,
             community_id: community.id
           )

    assert Repo.get_by!(ArticleHistoryOwner,
             article_id: article.id,
             community_id: destination.id
           )

    refute Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id)
  end

  test "moving a binding reassigns aggregated and pending metrics without counting retries twice",
       ~m(community destination post)a do
    binding = Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)
    first_operation = Ecto.UUID.generate()
    second_operation = Ecto.UUID.generate()
    occurred_at = DateTime.utc_now(:second)

    assert {:ok, :pass} =
             Analysis.MetricEvent.append_article_action(post, first_operation, :upvote_added,
               occurred_at: occurred_at
             )

    assert {:ok, _} = Aggregator.run()

    assert {:ok, :pass} =
             Analysis.MetricEvent.append_article_action(post, second_operation, :upvote_added,
               occurred_at: occurred_at
             )

    assert {:ok, _} =
             Repo.transact(fn ->
               BindingPersist.move(Repo.get!(Article, post.id), community, destination)
             end)

    assert {:ok, :pass} =
             Analysis.MetricEvent.append_article_action(post, second_operation, :upvote_added,
               binding_id: binding.id,
               community_id: destination.id,
               occurred_at: occurred_at
             )

    assert {:ok, _} = Aggregator.run()
    assert {:ok, 0} = Aggregator.run()

    events = Repo.all(Ecto.Query.where(MetricEvent, article_id: ^post.id))
    assert length(events) == 2
    assert Enum.all?(events, &(&1.binding_id == binding.id and &1.community_id == destination.id))

    assert %ArticleHourlyMetric{community_id: destination_id, value: 2} =
             Repo.get_by!(ArticleHourlyMetric, binding_id: binding.id, metric: :upvote_added)

    assert destination_id == destination.id
  end

  setup do
    {community, post, _, user} = mock_article(:post)
    {:ok, destination} = mock_community(user)
    user = grant_binding_actions(user, [community, destination])

    {:ok, ~m(community destination post user)a}
  end

  defp grant_binding_actions(user, communities) do
    for community <- communities do
      {:ok, _} =
        GroupherServer.Test.PassportFixture.grant_community(
          user,
          community.slug,
          %{
            "article.mirror" => true,
            "article.move" => true,
            "article.unmirror" => true,
            "post.pin" => true
          }
        )
    end

    user
  end

  test "all/1 returns every binding without selecting one implicitly",
       ~m(community destination post user)a do
    command_id = Ecto.UUID.generate()

    assert {:ok, mirrored} =
             CMS.Articles.mirror(
               destination,
               post.id,
               [],
               user,
               community,
               command_id
             )

    assert mirrored.id == post.id

    assert {:ok, replayed} =
             CMS.Articles.mirror(destination, post.id, [], user, community, command_id)

    assert replayed.id == mirrored.id

    assert {:ok, bindings} = Bindings.all(post)

    assert Enum.map(bindings, & &1.community_id) |> Enum.sort() ==
             Enum.sort([community.id, destination.id])
  end

  test "repeating a mirror does not advance the global Mentions revision",
       ~m(community destination post user)a do
    {:ok, before_revision} = Revision.current()

    assert {:ok, _article} =
             CMS.Articles.mirror(
               destination,
               post.id,
               [],
               user,
               community,
               Ecto.UUID.generate()
             )

    {:ok, after_first_mirror} = Revision.current()
    assert after_first_mirror == before_revision + 1

    assert {:ok, _article} =
             CMS.Articles.mirror(
               destination,
               post.id,
               [],
               user,
               community,
               Ecto.UUID.generate()
             )

    assert {:ok, after_retry} = Revision.current()
    assert after_retry == after_first_mirror
  end

  test "fetch_binding/2 and fetch_pin/2 return tagged catalog errors for missing rows",
       ~m(community post)a do
    assert {:ok, %ArticleBinding{article_id: article_id, community_id: community_id}} =
             Bindings.fetch_binding(post.id, community.id)

    assert article_id == post.id
    assert community_id == community.id

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :article},
              reason: :binding_not_found
            }} =
             Bindings.fetch_binding(Ecto.UUID.generate(), community.id)

    assert {:error, %ErrorCat.Error{namespace: {:cms, :article}, reason: :pin_not_found}} =
             Bindings.fetch_pin(post.id, community.id)
  end

  test "Tags.replace/2 and list/1 own binding-local assignments",
       ~m(community destination post user)a do
    {:ok, group} =
      CMS.Communities.create_tag_group(
        community,
        :post,
        %{title: "binding-tags"},
        user,
        Ecto.UUID.generate()
      )

    {:ok, tag} =
      CMS.Communities.create_tag(
        community,
        :post,
        Map.put(mock_attrs(:community_tag), :group_id, group.id),
        user,
        Ecto.UUID.generate()
      )

    {:ok, destination_group} =
      CMS.Communities.create_tag_group(
        destination,
        :post,
        %{title: "foreign-tags"},
        user,
        Ecto.UUID.generate()
      )

    {:ok, foreign_tag} =
      CMS.Communities.create_tag(
        destination,
        :post,
        Map.put(mock_attrs(:community_tag), :group_id, destination_group.id),
        user,
        Ecto.UUID.generate()
      )

    binding =
      Repo.get_by!(ArticleBinding,
        article_id: post.id,
        community_id: community.id
      )

    assert {:ok, ^binding} =
             Repo.transact(fn -> Tags.replace(binding, [to_string(tag.id)]) end)

    assert {:ok, [listed]} = Tags.list(binding)
    assert listed.id == tag.id

    assert {:error, :invalid_community_tags} =
             Repo.transact(fn -> Tags.replace(binding, [foreign_tag.id]) end)

    assert {:ok, [unchanged]} = Tags.list(binding)
    assert unchanged.id == tag.id
  end

  test "duplicate binding tags return a changeset error through the named primary key",
       ~m(community post user)a do
    {:ok, group} =
      CMS.Communities.create_tag_group(
        community,
        :post,
        %{title: "unique-tag"},
        user,
        Ecto.UUID.generate()
      )

    {:ok, tag} =
      CMS.Communities.create_tag(
        community,
        :post,
        Map.put(mock_attrs(:community_tag), :group_id, group.id),
        user,
        Ecto.UUID.generate()
      )

    binding =
      Repo.get_by!(ArticleBinding,
        article_id: post.id,
        community_id: community.id
      )

    attrs = %{article_binding_id: binding.id, tag_id: tag.id}

    assert {:ok, %ArticleBindingTag{}} =
             Repo.insert(ArticleBindingTag.changeset(%ArticleBindingTag{}, attrs))

    assert {:error, changeset} =
             Repo.insert(ArticleBindingTag.changeset(%ArticleBindingTag{}, attrs))

    assert {"has already been taken", _metadata} = changeset.errors[:article_binding_id]
  end

  test "Tags.replace/2 fails closed without an owner transaction", ~m(community post)a do
    binding =
      Repo.get_by!(ArticleBinding,
        article_id: post.id,
        community_id: community.id
      )

    assert {:error, :article_binding_transaction_required} = Tags.replace(binding, [])
  end

  test "a collected binding is rejected before unmirror deletes it",
       ~m(community destination post user)a do
    article = Repo.get!(Article, post.id)

    assert {:ok, _binding} =
             Repo.transact(fn -> BindingPersist.mirror(article, destination) end)

    assert {:ok, folder} =
             Accounts.CollectFolders.Persist.create(
               %{title: "binding-delete-guard", meta: Embeds.CollectFolderMeta.default_meta()},
               user
             )

    source_binding =
      Repo.get_by!(ArticleBinding,
        article_id: post.id,
        community_id: community.id
      )

    assert {:ok, %CollectFolderEntry{}} =
             %CollectFolderEntry{}
             |> CollectFolderEntry.changeset(%{
               folder_id: folder.id,
               article_id: post.id,
               article_binding_id: source_binding.id
             })
             |> Repo.insert()

    assert {:error, :article_binding_collected} =
             Repo.transact(fn -> BindingPersist.unmirror(article, community) end)

    assert Repo.get(ArticleBinding, source_binding.id)
  end

  test "a Post with a Draft Ticket link cannot move or unmirror after source review hiding",
       ~m(community destination post user)a do
    {:ok, _} =
      GroupherServer.Test.PassportFixture.grant_community(
        user,
        community.slug,
        %{"ticket.create" => true, "ticket.link_source" => true, "ticket.read_internal" => true}
      )

    {:ok, ticket} =
      CMS.Tickets.create_from_post(
        community,
        post.id,
        %{title: "Linked Ticket", digest: "Public summary"},
        user,
        Ecto.UUID.generate()
      )

    assert {:ok, _mirrored} =
             CMS.Articles.mirror(
               destination,
               post.id,
               [],
               user,
               community,
               Ecto.UUID.generate()
             )

    {:ok, other_destination} = mock_community(user)

    article = Repo.get!(Article, post.id)

    assert {:ok, _restriction} =
             Repo.transaction(fn ->
               with {:ok, lifecycle} <- CMS.Articles.Lifecycle.lock(article),
                    {:ok, restriction} <-
                      CMS.Articles.Lifecycle.apply_review_block(lifecycle, %{
                        operation_ref: Ecto.UUID.generate(),
                        scope_key: "community:#{community.id}",
                        type: :manual_hold,
                        source_ref: "ticket-binding-review:#{Ecto.UUID.generate()}",
                        source: :human,
                        actor: user,
                        applied_at: DateTime.utc_now(:second)
                      }) do
                 restriction
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)

    source_binding =
      Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)

    assert {:error, %ErrorCat.Error{reason: :post_linked_to_ticket}} =
             Repo.transact(fn -> BindingPersist.unmirror(article, community) end)

    assert {:error, %ErrorCat.Error{reason: :post_linked_to_ticket}} =
             Repo.transact(fn -> BindingPersist.move(article, community, destination) end)

    assert {:error, %ErrorCat.Error{reason: :post_linked_to_ticket}} =
             Repo.transact(fn -> BindingPersist.unmirror(article, destination) end)

    assert {:error, %ErrorCat.Error{reason: :post_linked_to_ticket}} =
             Repo.transact(fn ->
               BindingPersist.move(article, destination, other_destination)
             end)

    assert Repo.get(ArticleBinding, source_binding.id)
    assert Repo.get_by(ArticleBinding, article_id: post.id, community_id: destination.id)

    refute Repo.get_by(ArticleBinding,
             article_id: post.id,
             community_id: other_destination.id
           )

    ticket_article = Repo.get!(Article, ticket.id)
    assert {:error, _reason} = BindingSupport.ensure_ordinary(ticket_article)

    assert_raise Postgrex.Error, fn ->
      Repo.query!("DELETE FROM cms.article_bindings WHERE id = $1", [source_binding.id])
    end

    destination_binding =
      Repo.get_by!(ArticleBinding, article_id: post.id, community_id: destination.id)

    assert_raise Postgrex.Error, fn ->
      Repo.query!("DELETE FROM cms.article_bindings WHERE id = $1", [destination_binding.id])
    end
  end
end
