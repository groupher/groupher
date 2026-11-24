defmodule GroupherServer.Test.CMS.Articles.CommunityTrashCommandTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{Activity, CMS, Repo}
  alias CMS.Articles.Commands.{CommunityHide, CommunityRestore}
  alias CMS.Model.{ArticleBinding, ArticleBindingTrash, CommunityAdmin}
  alias GroupherServerWeb.Schema

  test "application GraphQL resolves local trash through scoped authorization" do
    {community, public, _, owner} = mock_article(:post)
    {:ok, actor} = db_insert(:user)
    demote_article_owner(community, owner)

    {:ok, _} =
      %CommunityAdmin{}
      |> CommunityAdmin.changeset(%{
        user_id: actor.id,
        community_id: community.id,
        joined_at: DateTime.utc_now(:second),
        permissions: %{
          "community.article.trash.read" => true,
          "community.article.hide" => true,
          "community.article.restore" => true
        }
      })
      |> Repo.insert()

    mutation = """
    mutation Hide($ref: String!, $article: ID!, $command: ID!) {
      hideCommunityArticle(communityRef: $ref, thread: POST, articleId: $article, commandId: $command) {
        id articleId recordRevision publicVisible
      }
    }
    """

    variables = %{
      "ref" => community.slug,
      "article" => public.id,
      "command" => Ecto.UUID.generate()
    }

    assert {:ok, %{data: %{"hideCommunityArticle" => result}}} =
             Absinthe.run(mutation, Schema, variables: variables, context: %{cur_user: actor})

    assert %{"id" => id, "articleId" => _, "recordRevision" => "1", "publicVisible" => false} =
             result

    assert {:ok, %{data: %{"hideCommunityArticle" => ^result}}} =
             Absinthe.run(mutation, Schema, variables: variables, context: %{cur_user: actor})

    query = """
    query Trash($ref: String!, $id: ID!) {
      communityArticleTrash(communityRef: $ref, thread: POST, id: $id) { id publicVisible }
    }
    """

    args = %{"ref" => community.slug, "id" => id}

    assert {:ok, %{data: %{"communityArticleTrash" => %{"id" => ^id}}}} =
             Absinthe.run(query, Schema, variables: args, context: %{cur_user: actor})

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(query, Schema, variables: args, context: %{cur_user: owner})

    doc_query = String.replace(query, "thread: POST", "thread: DOC")

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(doc_query, Schema, variables: args, context: %{cur_user: actor})

    ticket_query = String.replace(query, "thread: POST", "thread: TICKET")

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(ticket_query, Schema, variables: args, context: %{cur_user: actor})

    restore = """
    mutation Restore($ref: String!, $article: ID!, $id: ID!, $command: ID!) {
      restoreCommunityArticle(communityRef: $ref, thread: POST, articleId: $article,
        id: $id, recordRevision: "1", commandId: $command) { id commandId publicVisible }
    }
    """

    restore_args = Map.merge(variables, %{"id" => id, "command" => Ecto.UUID.generate()})

    assert {:ok, %{data: %{"restoreCommunityArticle" => restored}}} =
             Absinthe.run(restore, Schema, variables: restore_args, context: %{cur_user: actor})

    assert restored["publicVisible"]

    assert {:ok, %{data: %{"restoreCommunityArticle" => ^restored}}} =
             Absinthe.run(restore, Schema, variables: restore_args, context: %{cur_user: actor})

    assert {:ok, %{errors: [_ | _]}} =
             Absinthe.run(restore, Schema,
               variables: Map.put(restore_args, "command", Ecto.UUID.generate()),
               context: %{cur_user: actor}
             )
  end

  test "Community hide, restore, replay and stale identity preserve other site" do
    {site_a, public, _, owner} = mock_article(:post)
    {:ok, site_b} = mock_community(owner)
    demote_article_owner(site_a, owner)
    {:ok, actor} = db_insert(:user)

    {:ok, _} =
      %ArticleBinding{}
      |> ArticleBinding.changeset(%{article_id: public.id, community_id: site_b.id})
      |> Repo.insert()

    {:ok, _} =
      %CommunityAdmin{}
      |> CommunityAdmin.changeset(%{
        user_id: actor.id,
        community_id: site_a.id,
        joined_at: DateTime.utc_now(:second),
        permissions: %{
          "community.article.trash.read" => true,
          "community.article.hide" => true,
          "community.article.restore" => true
        }
      })
      |> Repo.insert()

    command = Ecto.UUID.generate()
    assert {:ok, first} = CommunityHide.execute(site_a, public.id, actor, command)
    assert {:ok, replay} = CommunityHide.execute(site_a, public.id, actor, command)
    assert first.id == replay.id

    assert {:ok, repeated} =
             CommunityHide.execute(site_a, public.id, actor, Ecto.UUID.generate())

    assert repeated.id == first.id

    assert Repo.aggregate(
             from(t in ArticleBindingTrash, where: t.article_id == ^public.id),
             :count
           ) == 1

    logs =
      Repo.all(
        from(l in Activity.Model.PostLog,
          where: l.article_id == ^public.id and l.action == :trashed
        )
      )

    assert [
             %{
               community_id: id,
               payload: %{"operation_scope" => "community", "effect" => "effective"}
             }
           ] = logs

    assert id == site_a.id
    {:ok, pagi} = GroupherServer.Pagi.from_input(nil)
    assert {:ok, page} = CMS.Articles.CommunityTrashQuery.page(site_a, actor, :post, pagi)
    assert [%{id: hidden_id, public_visible: false}] = page.entries
    assert hidden_id == first.id

    assert {:ok, %{id: ^hidden_id}} =
             CMS.Articles.CommunityTrashQuery.get(site_a, actor, :post, first.id)

    assert {:error, %{reason: :binding_not_found}} =
             CMS.Articles.CommunityTrashQuery.get(site_a, owner, :post, first.id)

    assert {:error, %{reason: :unsupported_community_trash_thread}} =
             CMS.Articles.CommunityTrashQuery.page(site_a, actor, :doc, pagi)

    receipt = Repo.get_by!(CMS.Model.CommandReceipt, command_id: command)
    assert hd(logs).operation_ref == receipt.operation_ref

    assert Repo.aggregate(
             from(e in CMS.Outbox.Event,
               where:
                 e.operation_ref == ^receipt.operation_ref and
                   e.event == "article.visibility_changed"
             ),
             :count
           ) == 1

    restore_id = Ecto.UUID.generate()

    assert {:ok, restored} =
             CommunityRestore.execute(site_a, public.id, first.id, "1", actor, restore_id)

    restore_logs =
      Repo.all(
        from(l in Activity.Model.PostLog,
          where: l.article_id == ^public.id and l.action == :restored
        )
      )

    assert [%{payload: %{"operation_scope" => "community", "effect" => "effective"}}] =
             restore_logs

    assert {:ok, replayed_restore} =
             CommunityRestore.execute(site_a, public.id, first.id, "1", actor, restore_id)

    assert restored.id == replayed_restore.id

    assert {:ok, next} =
             CommunityHide.execute(site_a, public.id, actor, Ecto.UUID.generate())

    refute next.id == first.id

    assert {:error, %{reason: :binding_trash_revision_conflict}} =
             CommunityRestore.execute(
               site_a,
               public.id,
               first.id,
               "1",
               actor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleBindingTrash, next.id)
    assert Repo.get_by!(ArticleBinding, article_id: public.id, community_id: site_b.id)
  end

  defp demote_article_owner(community, owner) do
    passport =
      Repo.get_by(CMS.Model.GlobalPassport, user_id: owner.id) || %CMS.Model.GlobalPassport{}

    Repo.insert_or_update!(
      CMS.Model.GlobalPassport.changeset(passport, %{
        user_id: owner.id,
        is_root: false
      })
    )

    admin =
      Repo.get_by!(CommunityAdmin,
        community_id: community.id,
        user_id: owner.id
      )

    Repo.update!(Ecto.Changeset.change(admin, is_lord: false, permissions: %{}))
  end
end
