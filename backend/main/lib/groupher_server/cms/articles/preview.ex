defmodule GroupherServer.CMS.Articles.Preview do
  @moduledoc """
  Forks an Article into an isolated Preview and promotes reviewed content back
  into the official main Draft.

      main/public -- fork --> preview/draft
          ^                         |
          |                         | edit / checkpoint / diff
          |                         v
          +-- publish -- main/draft <-- promote

  Promotion copies versioned content; it never changes the Preview branch type,
  never creates Preview/public, and never publishes directly. Runtime fields
  remain owned by the main/public row.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.BodyBag
  alias CMS.Articles.{Branch, Draft, Lock, Snapshot, VersionedRelations}
  alias CMS.Assets
  alias CMS.Model.{ArticleDocument, ArticleSnapshot, Community}
  alias Helper.{ORM, T}

  require CMS.Const

  @type result :: %{
          branch: CMS.Model.ArticleBranch.t(),
          draft: T.article(),
          snapshot: ArticleSnapshot.t()
        }

  @doc "Forks the current main/public Article into a newly-created Preview draft."
  @spec fork(Community.t(), T.thread(), Ecto.UUID.t(), map(), User.t()) ::
          {:ok, result()} | {:error, term()}
  def fork(%Community{} = community, thread, article_hash_id, attrs, %User{} = user) do
    Lock.run(community, thread, article_hash_id, fn ->
      with {:ok, branch} <- Branch.create_preview(community, thread, attrs, user),
           {:ok, source_branch} <- Branch.resolve(community, thread, branch.source_branch_id),
           true <- Branch.main?(source_branch),
           {:ok, draft, source_snapshot} <-
             create_fork_draft(
               community,
               thread,
               article_hash_id,
               branch,
               source_branch,
               attrs,
               user
             ),
           {:ok, snapshot} <-
             Snapshot.checkpoint_article(
               draft,
               CMS.Const.article_snapshot_action(:fork),
               user,
               source_snapshot_id: source_snapshot.id
             ) do
        {:ok, %{branch: branch, draft: draft, snapshot: snapshot}}
      else
        false -> {:error, {:custom, "Preview branches must fork from main/public"}}
        error -> error
      end
    end)
  end

  @doc "Promotes a Preview draft into main/draft and records an auditable Revision."
  @spec promote(Community.t(), T.thread(), Ecto.UUID.t(), term(), User.t()) ::
          {:ok, result()} | {:error, term()}
  def promote(
        %Community{} = community,
        thread,
        article_hash_id,
        preview_ref,
        %User{} = user
      ) do
    Lock.run(community, thread, article_hash_id, fn ->
      with {:ok, preview_branch} <- Branch.resolve(community, thread, preview_ref),
           true <- Branch.preview?(preview_branch),
           {:ok, preview_draft} <-
             Draft.read(community, thread, article_hash_id, preview_branch),
           {:ok, document} <- article_document(preview_draft, thread),
           {:ok, source_snapshot} <-
             Snapshot.checkpoint_article(
               preview_draft,
               CMS.Const.article_snapshot_action(:checkpoint),
               user
             ),
           :ok <- validate_main_has_not_changed(thread, preview_branch, source_snapshot),
           {:ok, main_branch} <- Branch.resolve(community, thread, Branch.main_slug()),
           {:ok, main_draft} <-
             upsert_main_draft(
               community,
               thread,
               article_hash_id,
               main_branch,
               preview_draft,
               document,
               user
             ),
           {:ok, main_draft} <- VersionedRelations.copy_to_draft(preview_draft, main_draft),
           {:ok, _asset_refs} <- Assets.copy_refs(preview_draft, main_draft),
           {:ok, snapshot} <-
             Snapshot.checkpoint_article(
               main_draft,
               CMS.Const.article_snapshot_action(:promote),
               user,
               source_snapshot_id: source_snapshot.id
             ) do
        {:ok, %{branch: preview_branch, draft: main_draft, snapshot: snapshot}}
      else
        false -> {:error, {:custom, "Only a Preview branch can be promoted"}}
        error -> error
      end
    end)
  end

  defp upsert_main_draft(
         community,
         thread,
         article_hash_id,
         main_branch,
         preview_draft,
         document,
         user
       ) do
    attrs = copy_attrs(preview_draft, document, main_branch)

    case Draft.read(community, thread, article_hash_id, main_branch) do
      {:ok, _draft} -> Draft.update_unlocked(community, thread, article_hash_id, attrs)
      {:error, _} -> create_or_copy_main_draft(community, thread, article_hash_id, attrs, user)
    end
  end

  defp create_or_copy_main_draft(community, thread, article_hash_id, attrs, user) do
    case Draft.read_public(community, thread, article_hash_id, attrs) do
      {:ok, _public} ->
        with {:ok, _draft} <-
               Draft.ensure_from_public_unlocked(community, thread, article_hash_id, attrs, user) do
          Draft.update_unlocked(community, thread, article_hash_id, attrs)
        end

      {:error, _} ->
        Draft.create(community, thread, Map.put(attrs, :article_hash_id, article_hash_id), user)
    end
  end

  defp preview_attrs(article, document, branch) do
    article
    |> copy_attrs(document, branch)
    |> Map.drop([:cover_url, :cover_url_dark])
  end

  defp create_fork_draft(
         community,
         thread,
         article_hash_id,
         branch,
         source_branch,
         attrs,
         user
       ) do
    case option(attrs, :source_snapshot_hash_id) do
      nil ->
        create_fork_from_public(
          community,
          thread,
          article_hash_id,
          branch,
          source_branch,
          user
        )

      snapshot_hash_id ->
        create_fork_from_snapshot(
          community,
          thread,
          article_hash_id,
          branch,
          source_branch,
          snapshot_hash_id,
          user
        )
    end
  end

  defp create_fork_from_public(
         community,
         thread,
         article_hash_id,
         branch,
         source_branch,
         user
       ) do
    with {:ok, public_article} <-
           Draft.read_public(community, thread, article_hash_id, source_branch),
         {:ok, document} <- article_document(public_article, thread),
         {:ok, draft} <-
           Draft.create(
             community,
             thread,
             preview_attrs(public_article, document, branch),
             user
           ),
         {:ok, draft} <- VersionedRelations.copy_to_draft(public_article, draft),
         {:ok, _asset_refs} <- Assets.copy_refs(public_article, draft),
         {:ok, source_snapshot} <-
           ensure_public_snapshot(public_article, thread, source_branch, user) do
      {:ok, draft, source_snapshot}
    end
  end

  defp create_fork_from_snapshot(
         community,
         thread,
         article_hash_id,
         branch,
         source_branch,
         snapshot_hash_id,
         user
       ) do
    with {:ok, snapshot} <-
           Snapshot.get(
             community,
             thread,
             article_hash_id,
             snapshot_hash_id,
             branch_id: source_branch.id
           ),
         {:ok, draft} <-
           Draft.create(
             community,
             thread,
             preview_snapshot_attrs(snapshot, branch),
             user
           ),
         {:ok, draft} <- VersionedRelations.restore(draft, snapshot.data) do
      {:ok, draft, snapshot}
    end
  end

  defp preview_snapshot_attrs(snapshot, branch) do
    snapshot.data
    |> atomize_keys()
    |> Map.drop([:community_tag_ids, :cover, :cover_url, :cover_url_dark])
    |> Map.merge(%{
      article_hash_id: snapshot.article_hash_id,
      branch_id: branch.id,
      title: snapshot.title,
      digest: snapshot.digest,
      slug: snapshot.slug,
      subtitle: snapshot.subtitle,
      body_bag: snapshot.body_bag
    })
  end

  defp copy_attrs(article, document, branch) do
    article
    |> Map.from_struct()
    |> Map.take(article.__struct__.version_fields())
    |> Map.drop([:cover_url, :cover_url_dark])
    |> Map.merge(%{
      article_hash_id: article.article_hash_id,
      branch_id: branch.id,
      body_bag: BodyBag.from_document_map(document)
    })
  end

  defp article_document(article, thread) do
    ORM.find_by(ArticleDocument, article_id: article.id, thread: thread)
  end

  defp latest_public_snapshot(thread, branch_id, article_hash_id) do
    ArticleSnapshot
    |> where([snapshot], snapshot.thread == ^thread)
    |> where([snapshot], snapshot.branch_id == ^branch_id)
    |> where([snapshot], snapshot.article_hash_id == ^article_hash_id)
    |> where([snapshot], snapshot.stage == CMS.Const.stage(:public))
    |> order_by([snapshot], desc: snapshot.revision_number, desc: snapshot.id)
    |> limit(1)
    |> Repo.one()
  end

  defp ensure_public_snapshot(public_article, thread, source_branch, user) do
    case latest_public_snapshot(thread, source_branch.id, public_article.article_hash_id) do
      %ArticleSnapshot{} = snapshot ->
        {:ok, snapshot}

      nil ->
        Snapshot.checkpoint_article(
          public_article,
          CMS.Const.article_snapshot_action(:checkpoint),
          user
        )
    end
  end

  defp validate_main_has_not_changed(thread, preview_branch, source_snapshot) do
    fork_snapshot =
      ArticleSnapshot
      |> where([snapshot], snapshot.thread == ^thread)
      |> where([snapshot], snapshot.branch_id == ^preview_branch.id)
      |> where([snapshot], snapshot.article_hash_id == ^source_snapshot.article_hash_id)
      |> where([snapshot], snapshot.action == CMS.Const.article_snapshot_action(:fork))
      |> order_by([snapshot], asc: snapshot.revision_number, asc: snapshot.id)
      |> limit(1)
      |> Repo.one()

    with %ArticleSnapshot{source_snapshot_id: source_snapshot_id}
         when not is_nil(source_snapshot_id) <- fork_snapshot,
         %ArticleSnapshot{} = base_snapshot <- Repo.get(ArticleSnapshot, source_snapshot_id),
         %ArticleSnapshot{} = current_snapshot <-
           latest_public_snapshot(thread, base_snapshot.branch_id, base_snapshot.article_hash_id),
         true <- current_snapshot.version_hash == base_snapshot.version_hash do
      :ok
    else
      false -> {:error, {:conflict, "main/public changed after the Preview fork"}}
      _ -> {:error, {:conflict, "Preview fork base is unavailable"}}
    end
  end

  defp atomize_keys(map) do
    Map.new(map, fn
      {key, value} when is_binary(key) -> {String.to_existing_atom(key), value}
      pair -> pair
    end)
  end

  defp option(attrs, key), do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))
end
