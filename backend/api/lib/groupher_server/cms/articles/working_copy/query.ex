defmodule GroupherServer.CMS.Articles.WorkingCopy.Query do
  @moduledoc """
  Loads scoped WorkingCopies and Snapshots after the caller has authorized the Article.

      authorized Article + Community -> scoped owner queries -> WorkingCopy/Snapshot result
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Bindings

  alias CMS.Model.{
    Article,
    ArticleSnapshot,
    ArticleSnapshotBlog,
    ArticleSnapshotChangelog,
    ArticleSnapshotDoc,
    ArticleSnapshotPost,
    ArticleSnapshotTag,
    ArticleWorkingCopy,
    ArticleWorkingCopyBlog,
    ArticleWorkingCopyChangelog,
    ArticleWorkingCopyDoc,
    ArticleWorkingCopyPost,
    ArticleWorkingCopyTag,
    Community
  }

  @doc "Lists independent WorkingCopies after Article edit admission."
  def working_copies(%Article{thread: :doc} = article, %Community{} = community) do
    with {:ok, _binding} <- Bindings.get(article, community) do
      {:ok,
       Repo.all(
         from(work in ArticleWorkingCopy,
           join: body in assoc(work, :body),
           preload: [body: body],
           where:
             work.article_id == ^article.id and work.scope_type == :default and
               work.scope_id == ^article.id
         )
       )}
    end
  end

  def working_copies(%Article{} = article, %Community{} = community) do
    with {:ok, _binding} <- Bindings.get(article, community) do
      rows =
        Repo.all(
          from(work in ArticleWorkingCopy,
            join: body in assoc(work, :body),
            preload: [body: body],
            where: work.article_id == ^article.id,
            order_by: [
              asc: work.scope_type,
              asc: work.scope_id,
              asc: work.inserted_at,
              asc: work.id
            ]
          )
        )

      {:ok, rows}
    end
  end

  @doc "Lists immutable Article Snapshots after Article edit admission."
  def snapshots(%Article{thread: :doc} = article, %Community{} = community) do
    with {:ok, _binding} <- Bindings.get(article, community), do: {:ok, []}
  end

  def snapshots(%Article{} = article, %Community{} = community) do
    with {:ok, _binding} <- Bindings.get(article, community) do
      rows =
        Repo.all(
          from(snapshot in ArticleSnapshot,
            join: body in assoc(snapshot, :body),
            preload: [body: body],
            where: snapshot.article_id == ^article.id,
            order_by: [desc: snapshot.captured_at, desc: snapshot.id]
          )
        )

      {:ok, rows}
    end
  end

  @doc "Loads one immutable Snapshot after Article edit admission."
  def snapshot(%Article{thread: :doc} = article, %Community{} = community, snapshot_id)
      when is_binary(snapshot_id) do
    with {:ok, _binding} <- Bindings.get(article, community), do: {:error, :snapshot_not_found}
  end

  def snapshot(%Article{} = article, %Community{} = community, snapshot_id)
      when is_binary(snapshot_id) do
    with {:ok, _binding} <- Bindings.get(article, community) do
      case Repo.get_by(ArticleSnapshot, id: snapshot_id, article_id: article.id) do
        %ArticleSnapshot{} = snapshot -> {:ok, Repo.preload(snapshot, :body)}
        nil -> {:error, :snapshot_not_found}
      end
    end
  end

  @doc "Loads one editable Article WorkingCopy after Article edit admission."
  def working_copy(%Article{thread: :doc} = article, %Community{} = community, working_copy_id)
      when is_binary(working_copy_id) do
    with {:ok, _binding} <- Bindings.get(article, community) do
      case Repo.get_by(ArticleWorkingCopy,
             id: working_copy_id,
             article_id: article.id,
             scope_type: :default,
             scope_id: article.id
           ) do
        %ArticleWorkingCopy{} = work -> {:ok, Repo.preload(work, :body)}
        nil -> {:error, :working_copy_not_found}
      end
    end
  end

  def working_copy(%Article{} = article, %Community{} = community, working_copy_id)
      when is_binary(working_copy_id) do
    with {:ok, _binding} <- Bindings.get(article, community) do
      case Repo.get_by(ArticleWorkingCopy,
             id: working_copy_id,
             article_id: article.id
           ) do
        %ArticleWorkingCopy{} = work -> {:ok, Repo.preload(work, :body)}
        nil -> {:error, :working_copy_not_found}
      end
    end
  end

  @doc "Loads the strong-typed content fields for one WorkingCopy."
  def working_copy_thread_fields(%ArticleWorkingCopy{} = work) do
    with {:ok, article} <- fetch_article(work.article_id),
         {:ok, fields} <- typed_fields(:working_copy, article.thread, work.id) do
      {:ok, fields}
    end
  end

  @doc "Loads the strong-typed content fields for one Snapshot."
  def snapshot_thread_fields(%ArticleSnapshot{} = snapshot) do
    with {:ok, article} <- fetch_article(snapshot.article_id),
         {:ok, fields} <- typed_fields(:snapshot, article.thread, snapshot.id) do
      {:ok, fields}
    end
  end

  @doc "Returns the tag IDs owned by one WorkingCopy."
  def working_copy_tag_ids(%ArticleWorkingCopy{id: working_copy_id}) do
    {:ok,
     Repo.all(
       from(tag in ArticleWorkingCopyTag,
         where: tag.working_copy_id == ^working_copy_id,
         order_by: [asc: tag.tag_id],
         select: tag.tag_id
       )
     )}
  end

  @doc "Returns the tag IDs captured by one immutable Snapshot."
  def snapshot_tag_ids(%ArticleSnapshot{id: snapshot_id}) do
    {:ok,
     Repo.all(
       from(tag in ArticleSnapshotTag,
         where: tag.snapshot_id == ^snapshot_id,
         order_by: [asc: tag.tag_id],
         select: tag.tag_id
       )
     )}
  end

  defp fetch_article(article_id) do
    case Repo.get(Article, article_id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :article_not_found}
    end
  end

  defp typed_fields(kind, thread, owner_id) do
    {model, owner_key, fields} = typed_extension(kind, thread)

    case Repo.get_by(model, [{owner_key, owner_id}]) do
      nil -> {:error, :thread_fields_not_found}
      row -> {:ok, row |> Map.from_struct() |> Map.take(fields)}
    end
  end

  defp typed_extension(:working_copy, :post) do
      {ArticleWorkingCopyPost, :working_copy_id,
       ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:working_copy, :blog) do
      {ArticleWorkingCopyBlog, :working_copy_id,
       ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:working_copy, :changelog) do
      {ArticleWorkingCopyChangelog, :working_copy_id,
       ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:working_copy, :doc) do
      {ArticleWorkingCopyDoc, :working_copy_id,
       ~w(subtitle link_addr template_key cover_url cover_url_dark)a}
  end

  defp typed_extension(:snapshot, :post) do
    {ArticleSnapshotPost, :snapshot_id, ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:snapshot, :blog) do
    {ArticleSnapshotBlog, :snapshot_id, ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:snapshot, :changelog) do
      {ArticleSnapshotChangelog, :snapshot_id, ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:snapshot, :doc) do
      {ArticleSnapshotDoc, :snapshot_id,
       ~w(subtitle link_addr template_key cover_url cover_url_dark)a}
  end
end
