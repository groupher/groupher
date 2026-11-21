defmodule GroupherServer.Test.CMS.Gate.Scope.BindingTrashTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Context.Scope.{Article, Comment}
  alias CMS.Model.{ArticleBinding, ArticleBindingTrash}

  test "hidden binding excludes Article and Comment only at that Community, including their author" do
    {site_a, public, _, actor} = mock_article(:post)
    {:ok, site_b} = mock_community(actor)

    binding_a =
      Repo.get_by!(ArticleBinding, article_id: public.id, community_id: site_a.id)

    {:ok, binding_b} =
      %ArticleBinding{}
      |> ArticleBinding.changeset(%{
        article_id: public.id,
        community_id: site_b.id,
        inner_id: 1_000_001
      })
      |> Repo.insert()

    {:ok, comment} =
      CMS.Comments.create_comment(
        site_a,
        :post,
        public.inner_id,
        mock_comment("hello"),
        actor,
        Ecto.UUID.generate()
      )

    article_at = fn site, viewer ->
      CMS.Model.Article
      |> CMS.Gate.scope(viewer, :list, Article.public(:post))
      |> where([article, ...], article.id == ^public.id)
      |> where([gate_community: community], community.id == ^site.id)
      |> Repo.all()
      |> length()
    end

    comment_at = fn site, viewer ->
      CMS.Model.Comment
      |> CMS.Gate.scope(viewer, :list, Comment.for_thread(:post, community_id: site.id))
      |> where([comment], comment.id == ^comment.id)
      |> Repo.all()
      |> length()
    end

    mentioned_at = fn site, viewer ->
      CMS.Model.Comment
      |> CMS.Gate.scope(viewer, :read, Comment.mentioned_target(:post, site.id))
      |> where([row], row.id == ^comment.id)
      |> Repo.all()
      |> length()
    end

    assert article_at.(site_a, nil) == 1
    assert article_at.(site_b, nil) == 1
    assert comment_at.(site_a, nil) == 1
    assert comment_at.(site_b, nil) == 1

    {:ok, hidden} =
      %ArticleBindingTrash{}
      |> ArticleBindingTrash.changeset(%{
        community_id: site_a.id,
        article_id: public.id,
        binding_id: binding_a.id,
        actor_id: actor.id,
        hidden_at: DateTime.utc_now(:second)
      })
      |> Repo.insert()

    for viewer <- [nil, actor] do
      assert article_at.(site_a, viewer) == 0
      assert article_at.(site_b, viewer) == 1
      assert comment_at.(site_a, viewer) == 0
      assert comment_at.(site_b, viewer) == 1
      assert mentioned_at.(site_a, viewer) == 0
      assert mentioned_at.(site_b, viewer) == 1
    end

    assert {:error, _} =
             CMS.Comments.create_comment(
               site_a,
               :post,
               public.inner_id,
               mock_comment("hidden"),
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Comments.create_comment(
               site_b,
               :post,
               binding_b.inner_id,
               mock_comment("visible"),
               actor,
               Ecto.UUID.generate()
             )

    for {action, context} <- [
          {:read, Article.public(:post, policy_mode: :owner)},
          {:read_insights, Article.insights(:post)}
        ] do
      query =
        CMS.Model.Article
        |> CMS.Gate.scope(actor, action, context)
        |> where([article, ...], article.id == ^public.id)
        |> where([gate_community: community], community.id == ^site_a.id)

      assert length(Repo.all(query)) == 1
    end

    Repo.delete!(hidden)
    assert article_at.(site_a, nil) == 1
    assert comment_at.(site_a, nil) == 1
  end
end
