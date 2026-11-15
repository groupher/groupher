defmodule GroupherServer.CMS.Articles.WorkingCopy.Snapshotter do
  @moduledoc """
  Freezes saved content into an immutable Snapshot or clones a Snapshot into a new owner.

      authorized transaction -> WorkingCopy revision -> Snapshot
      immutable Snapshot -> independent WorkingCopy + owner references
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User
  alias CMS.Articles.Body
  alias CMS.Assets.Refs, as: AssetRefs

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
    CoverEditSnapshot,
    CoverEditWorkingCopy
  }

  @snapshot_fields ~w(title digest slug)a

  @doc "Freezes the expected saved revision; callers must already have authorized the command."
  def freeze_in_transaction(working_copy_id, revision, %User{} = actor, command_id)
      when is_binary(working_copy_id) and is_integer(revision) and is_binary(command_id) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, article} <- lock_article_for_work(working_copy_id),
         {:ok, work} <- lock_work(working_copy_id),
         true <- work.article_id == article.id,
         {:ok, :pass} <- ensure_revision(work, revision),
         {:ok, existing} <- existing_snapshot(work) do
      case existing do
        %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
        nil -> freeze_locked(article, work, actor, command_id)
      end
    else
      false -> {:error, :snapshot_owner_mismatch}
      {:error, _reason} = error -> error
    end
  end

  @doc false
  def freeze_locked(
        %Article{} = article,
        %ArticleWorkingCopy{} = work,
        %User{} = actor,
        command_id
      ) do
    with {:ok, existing} <- existing_snapshot(work) do
      case existing do
        %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
        nil -> freeze_new_snapshot(article, work, actor, command_id)
      end
    end
  end

  defp freeze_new_snapshot(article, work, actor, command_id) do
    captured_at = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    with {:ok, cover_snapshot_id} <- freeze_cover(work.cover_edit_working_copy_id, captured_at),
         params =
           work
           |> Map.take(@snapshot_fields)
           |> Map.merge(%{
             body: Map.merge(Body.document(work), %{article_id: article.id, type: :snapshot}),
             article_id: article.id,
             source_working_copy_id: work.id,
             source_revision: work.revision,
             cover_edit_snapshot_id: cover_snapshot_id,
             captured_by_id: actor.id,
             captured_at: captured_at,
             causation_command_id: command_id
           }),
         {:ok, snapshot} <-
           %ArticleSnapshot{} |> ArticleSnapshot.changeset(params) |> Repo.insert(),
         {:ok, :pass} <- freeze_typed_fields(article.thread, work, snapshot),
         {:ok, :pass} <- freeze_tags(work, snapshot),
         {:ok, _asset_refs} <- AssetRefs.copy_working_copy_refs_to_snapshot(work.id, snapshot.id) do
      {:ok, snapshot}
    end
  end

  @doc "Creates a new independent WorkingCopy from a Snapshot; caller owns Gate and Receipt."
  def fork_snapshot_in_transaction(snapshot_id, target_scope, %User{} = actor)
      when is_binary(snapshot_id) and is_map(target_scope) do
    with {:ok, :pass} <- require_transaction(),
         %ArticleSnapshot{} = identity <- Repo.get(ArticleSnapshot, snapshot_id),
         {:ok, article} <- lock_article(identity.article_id),
         {:ok, snapshot} <- lock_snapshot(snapshot_id),
         true <- snapshot.article_id == article.id,
         {:ok, :pass} <- validate_target_article(snapshot, target_scope),
         {:ok, :pass} <- ensure_scope_available(snapshot.article_id, target_scope),
         {:ok, cover_id} <- clone_cover(snapshot.cover_edit_snapshot_id),
         {:ok, work} <- clone_work(snapshot, target_scope, cover_id, actor),
         {:ok, :pass} <- clone_typed_fields(article.thread, snapshot, work),
         {:ok, :pass} <- clone_tags(snapshot, work),
         {:ok, _asset_refs} <- AssetRefs.copy_snapshot_refs_to_working_copy(snapshot.id, work.id) do
      {:ok, work}
    else
      nil -> {:error, :snapshot_not_found}
      false -> {:error, :snapshot_owner_mismatch}
      {:error, _reason} = error -> error
    end
  end

  defp lock_article_for_work(working_copy_id) do
    owner =
      from(work in ArticleWorkingCopy,
        where: work.id == ^working_copy_id,
        select: work.article_id
      )

    query =
      from(article in Article,
        where: article.id in subquery(owner),
        lock: "FOR UPDATE"
      )

    case Repo.one(query) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :working_copy_not_found}
    end
  end

  defp lock_work(id) do
    case Repo.one(from(work in ArticleWorkingCopy, where: work.id == ^id, lock: "FOR UPDATE")) do
      %ArticleWorkingCopy{} = work -> {:ok, work}
      nil -> {:error, :working_copy_not_found}
    end
  end

  defp lock_snapshot(id) do
    case Repo.one(
           from(snapshot in ArticleSnapshot, where: snapshot.id == ^id, lock: "FOR UPDATE")
         ) do
      %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
      nil -> {:error, :snapshot_not_found}
    end
  end

  defp lock_article(id) do
    case Repo.one(from(article in Article, where: article.id == ^id, lock: "FOR UPDATE")) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :article_not_found}
    end
  end

  defp validate_target_article(snapshot, target_scope) do
    case Map.get(target_scope, :article_id, snapshot.article_id) do
      id when id == snapshot.article_id -> {:ok, :pass}
      _ -> {:error, :snapshot_owner_mismatch}
    end
  end

  defp ensure_scope_available(article_id, target_scope) do
    scope_type = Map.get(target_scope, :scope_type)
    scope_id = Map.get(target_scope, :scope_id)

    case Repo.get_by(ArticleWorkingCopy,
           article_id: article_id,
           scope_type: scope_type,
           scope_id: scope_id
         ) do
      nil -> {:ok, :pass}
      _work -> {:error, :scope_occupied}
    end
  end

  defp clone_cover(nil), do: {:ok, nil}

  defp clone_cover(id) do
    case Repo.get(CoverEditSnapshot, id) do
      %CoverEditSnapshot{} = cover ->
        attrs = Map.take(cover, ~w(format_version canvas_width canvas_height light dark)a)

        case %CoverEditWorkingCopy{}
             |> CoverEditWorkingCopy.changeset(attrs)
             |> Repo.insert() do
          {:ok, working_copy} -> {:ok, working_copy.id}
          {:error, _changeset} = error -> error
        end

      nil ->
        {:error, :cover_edit_snapshot_not_found}
    end
  end

  defp clone_work(snapshot, target_scope, cover_id, actor) do
    attrs =
      snapshot
      |> Map.take(@snapshot_fields)
      |> Map.merge(%{
        body:
          Map.merge(Body.document(snapshot), %{
            article_id: snapshot.article_id,
            type: :working_copy
          }),
        article_id: snapshot.article_id,
        scope_type: Map.get(target_scope, :scope_type),
        scope_id: Map.get(target_scope, :scope_id),
        revision: 1,
        cover_edit_working_copy_id: cover_id,
        created_by_id: actor.id,
        updated_by_id: actor.id
      })

    case %ArticleWorkingCopy{} |> ArticleWorkingCopy.changeset(attrs) |> Repo.insert() do
      {:ok, work} ->
        {:ok, work}

      {:error, changeset} ->
        if Enum.any?(changeset.errors, fn {_field, {_message, meta}} ->
             meta[:constraint] == :unique
           end) do
          {:error, :scope_occupied}
        else
          {:error, changeset}
        end
    end
  end

  defp existing_snapshot(work) do
    snapshot =
      Repo.one(
        from(snapshot in ArticleSnapshot,
          where:
            snapshot.source_working_copy_id == ^work.id and
              snapshot.source_revision == ^work.revision
        )
      )

    {:ok, snapshot}
  end

  defp freeze_cover(nil, _captured_at), do: {:ok, nil}

  defp freeze_cover(id, captured_at) do
    case Repo.get(CoverEditWorkingCopy, id) do
      %CoverEditWorkingCopy{} = cover ->
        params = %{
          format_version: cover.format_version,
          canvas_width: cover.canvas_width,
          canvas_height: cover.canvas_height,
          light: cover.light,
          dark: cover.dark,
          captured_at: captured_at
        }

        case %CoverEditSnapshot{} |> CoverEditSnapshot.changeset(params) |> Repo.insert() do
          {:ok, snapshot} -> {:ok, snapshot.id}
          {:error, _changeset} = error -> error
        end

      nil ->
        {:error, :cover_edit_not_found}
    end
  end

  defp freeze_typed_fields(:ticket, _work, _snapshot), do: {:ok, :pass}

  defp freeze_typed_fields(thread, work, snapshot) do
    {working_model, snapshot_model, fields} = typed_extension(thread)

    case Repo.get_by(working_model, working_copy_id: work.id) do
      nil ->
        {:error, :working_copy_thread_fields_not_found}

      row ->
        params = Map.take(row, fields) |> Map.put(:snapshot_id, snapshot.id)

        case snapshot_model |> struct() |> snapshot_model.changeset(params) |> Repo.insert() do
          {:ok, _row} -> {:ok, :pass}
          {:error, _changeset} = error -> error
        end
    end
  end

  defp typed_extension(:post) do
      {ArticleWorkingCopyPost, ArticleSnapshotPost,
       ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:blog) do
      {ArticleWorkingCopyBlog, ArticleSnapshotBlog,
       ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:changelog) do
      {ArticleWorkingCopyChangelog, ArticleSnapshotChangelog,
       ~w(copy_right link_addr cover_url cover_url_dark)a}
  end

  defp typed_extension(:doc) do
      {ArticleWorkingCopyDoc, ArticleSnapshotDoc,
       ~w(subtitle link_addr template_key cover_url cover_url_dark)a}
  end

  defp freeze_tags(work, snapshot) do
    tags = Repo.all(from(tag in ArticleWorkingCopyTag, where: tag.working_copy_id == ^work.id))

    Enum.reduce_while(tags, {:ok, :pass}, fn tag, {:ok, _} ->
      attrs = %{snapshot_id: snapshot.id, tag_id: tag.tag_id}

      case %ArticleSnapshotTag{} |> ArticleSnapshotTag.changeset(attrs) |> Repo.insert() do
        {:ok, _row} -> {:cont, {:ok, :pass}}
        {:error, _changeset} = error -> {:halt, error}
      end
    end)
  end

  defp clone_typed_fields(:ticket, _snapshot, _work), do: {:ok, :pass}

  defp clone_typed_fields(thread, snapshot, work) do
    {working_model, snapshot_model, fields} = typed_extension(thread)

    case Repo.get_by(snapshot_model, snapshot_id: snapshot.id) do
      nil ->
        {:error, :snapshot_thread_fields_not_found}

      row ->
        attrs = Map.take(row, fields) |> Map.put(:working_copy_id, work.id)

        case working_model |> struct() |> working_model.changeset(attrs) |> Repo.insert() do
          {:ok, _row} -> {:ok, :pass}
          {:error, _changeset} = error -> error
        end
    end
  end

  defp clone_tags(snapshot, work) do
    tags = Repo.all(from(tag in ArticleSnapshotTag, where: tag.snapshot_id == ^snapshot.id))

    Enum.reduce_while(tags, {:ok, :pass}, fn tag, {:ok, _} ->
      attrs = %{working_copy_id: work.id, tag_id: tag.tag_id}

      case %ArticleWorkingCopyTag{} |> ArticleWorkingCopyTag.changeset(attrs) |> Repo.insert() do
        {:ok, _row} -> {:cont, {:ok, :pass}}
        {:error, _changeset} = error -> {:halt, error}
      end
    end)
  end

  defp ensure_revision(%ArticleWorkingCopy{revision: revision}, revision), do: {:ok, :pass}
  defp ensure_revision(%ArticleWorkingCopy{}, _expected), do: {:error, :revision_conflict}

  defp require_transaction do
    if Repo.in_transaction?(), do: {:ok, :pass}, else: {:error, :transaction_required}
  end
end
