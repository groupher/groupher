defmodule GroupherServer.CMS.Articles.SnapshotProjection do
  @moduledoc """
  Builds public Article views from the immutable Snapshot selected by ArticlePublic.

      Article + Public snapshot_id -> typed Snapshot content -> ArticleView projection
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Review.SnapshotVersion
  alias CMS.Articles.ArticleView

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticleSnapshot,
    ArticleSnapshotBlog,
    ArticleSnapshotChangelog,
    ArticleSnapshotDoc,
    ArticleSnapshotPost,
    ArticlePublic,
    Community,
    CommunityTag,
    ArticleSnapshotTag,
    PostState
  }

  @doc "Builds a public projection from the exact Snapshot selected by ArticlePublic."
  def build_stable(
        %Article{} = article,
        %Community{} = community,
        %ArticlePublic{snapshot_id: snapshot_id} = public,
        %ArticleSnapshot{article_id: article_id, id: snapshot_id} = snapshot
      )
      when article.id == article_id do
    article = Repo.preload(article, author: :user)
    binding = Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id)

    with true <- not is_nil(binding),
         {:ok, asset_refs} <- CMS.Assets.content_refs(:snapshot, snapshot.id),
         {:ok, participants} <- CMS.ArticleStats.comment_participants(article.thread, article.id),
         {:ok, community_tags} <- CMS.Articles.Bindings.Tags.list(binding),
         article_tags <- snapshot_tags(snapshot.id),
         extension when is_map(extension) <- snapshot_extension(article.thread, snapshot.id),
         %ArticleLifecycle{} = lifecycle <- Repo.get_by(ArticleLifecycle, article_id: article.id) do
      body = %{
        json: snapshot.body_json,
        markdown: snapshot.body_markdown,
        html: snapshot.body_html,
        markdown_toc: snapshot.body_markdown_toc,
        plain_text: snapshot.body_plain_text,
        digest: snapshot.digest,
        schema_version: snapshot.body_schema_version,
        thumbnail: snapshot.body_thumbnail
      }

      projection =
        %{
          id: article.id,
          article_id: article.id,
          snapshot_id: snapshot.id,
          branch_id: nil,
          inner_id: binding.inner_id,
          thread: article.thread,
          stage: :public,
          title: public.title,
          digest: public.digest,
          slug: public.slug,
          body: body,
          asset_refs: asset_refs,
          author_id: article.author_id,
          author: article.author.user,
          community: community,
          communities: [community],
          community_tags: community_tags,
          article_tags: article_tags,
          comments_participants: participants,
          active_at: article.active_at,
          inserted_at: public.published_at,
          updated_at: public.published_at,
          version: SnapshotVersion.from_id(snapshot.id),
          lifecycle: lifecycle,
          is_pinned: pinned?(binding.id),
          viewer_has_collected: false,
          viewer_has_upvoted: false,
          viewer_has_viewed: false,
          meta: article_meta(article, lifecycle)
        }
        |> Map.merge(post_state(article))
        |> Map.merge(extension)

      {:ok, ArticleView.from_map(projection)}
    else
      false -> {:error, :article_binding_not_found}
      nil -> {:error, :article_snapshot_projection_missing}
      {:error, _reason} = error -> error
      _ -> {:error, :article_snapshot_projection_missing}
    end
  end

  def build_stable(_article, _community, _public, _snapshot),
    do: {:error, :snapshot_owner_mismatch}

  defp snapshot_extension(thread, id) do
    case thread do
      :post -> extension(ArticleSnapshotPost, id)
      :blog -> extension(ArticleSnapshotBlog, id)
      :changelog -> extension(ArticleSnapshotChangelog, id)
      :doc -> extension(ArticleSnapshotDoc, id)
      :ticket -> %{}
      _ -> nil
    end
  end

  defp snapshot_tags(snapshot_id) do
    Repo.all(
      from(tag in CommunityTag,
        join: assignment in ArticleSnapshotTag,
        on: assignment.tag_id == tag.id,
        where: assignment.snapshot_id == ^snapshot_id,
        order_by: [asc: tag.index, asc: tag.id]
      )
    )
  end

  defp extension(model, id) do
    case Repo.get_by(model, snapshot_id: id) do
      nil -> nil
      row -> Map.drop(Map.from_struct(row), [:__meta__, :snapshot_id, :inserted_at, :updated_at])
    end
  end

  defp post_state(%Article{thread: :post, id: id}) do
    case Repo.get(PostState, id) do
      %PostState{cat: cat} -> %{cat: cat}
      _ -> %{cat: nil}
    end
  end

  defp post_state(_), do: %{}

  defp article_meta(%Article{} = article, %ArticleLifecycle{} = lifecycle) do
    %{
      thread: article.thread,
      is_edited: article.is_edited,
      is_comment_locked: article.comments_locked,
      is_sunk: article.is_sunk,
      last_active_at: article.last_active_at,
      next_floor: article.next_floor,
      next_comment_inner_id: article.next_comment_inner_id,
      lifecycle_version: lifecycle.version
    }
  end

  defp pinned?(binding_id) do
    case Repo.get_by(CMS.Model.PinnedArticle,
           article_binding_id: binding_id
         ) do
      nil -> false
      _ -> true
    end
  end
end
