defmodule GroupherServer.CMS.Articles.WorkingCopy.Store do
  @moduledoc """
  Persists complete mutable Article WorkingCopies inside a caller-owned transaction.

  Gate admission and the outer Command Receipt belong to the authenticated command.
  This module owns content, CoverEdit, tag, and optimistic-revision writes.

      caller-owned transaction -> complete WorkingCopy patch -> dependent owner rows + next revision
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.BodyBag
  alias CMS.Assets.Refs, as: AssetRefs

  alias CMS.Model.{
    Article,
    ArticleSnapshot,
    ArticleWorkingCopy,
    ArticleWorkingCopyBlog,
    ArticleWorkingCopyChangelog,
    ArticleWorkingCopyDoc,
    ArticleWorkingCopyPost,
    ArticleWorkingCopyTag,
    CommunityTag,
    CoverEditWorkingCopy
  }

  @work_fields ~w(title digest slug)a
  @cover_fields ~w(format_version canvas_width canvas_height light dark)a
  @body_fields ~w(body_json body_schema_version body_markdown body_html body_markdown_toc body_plain_text body_thumbnail body_xml body_rss)a

  @doc "Creates one WorkingCopy and its optional cover and tag relations in the current transaction."
  def create_loaded(%Article{} = article, attrs, %User{} = actor, community_id)
      when is_map(attrs) and is_integer(community_id) do
    attrs = normalize_cover_attrs(attrs)

    with {:ok, :pass} <- require_transaction(),
         {:ok, body} <- cast_body(attrs, article.thread),
         {:ok, tags} <- requested_tags(attrs, article, attrs, community_id),
         {:ok, cover_id} <- create_cover(attrs),
         {:ok, work} <- insert_work(article, attrs, body, cover_id, actor),
         {:ok, _typed} <- insert_typed_work(work, article.thread, attrs),
         {:ok, _} <- replace_tags(work, tags),
         {:ok, _asset_refs} <- sync_asset_refs(community_id, article, work, attrs, actor) do
      {:ok, work}
    else
      {:error, %Ecto.Changeset{} = changeset} -> normalize_create_changeset(changeset)
      {:error, _reason} = error -> error
    end
  end

  @doc "Saves a partial content patch atomically and rejects a stale WorkingCopy revision."
  def save_loaded(
        %ArticleWorkingCopy{} = work,
        attrs,
        %User{} = actor,
        revision,
        community_id
      )
      when is_map(attrs) and is_integer(revision) and is_integer(community_id) do
    save_with_body(work, attrs, actor, revision, community_id, :input, :derived)
  end

  @doc "Copies a saved Doc body while applying the caller's complete merge patch in its transaction."
  def save_stored_body_loaded(
        %ArticleWorkingCopy{} = work,
        source,
        attrs,
        %User{} = actor,
        revision,
        community_id
      )
      when is_map(attrs) and is_integer(revision) and is_integer(community_id) do
    if fetch_present(attrs, :body_bag) == :missing do
      save_with_body(work, attrs, actor, revision, community_id, {:stored, source}, :derived)
    else
      {:error, :ambiguous_body_source}
    end
  end

  @doc "Saves a selected Doc merge, preserving complete selected cover asset references."
  def save_merged_loaded(
        %ArticleWorkingCopy{} = work,
        source,
        attrs,
        cover_refs,
        %User{} = actor,
        revision,
        community_id
      )
      when is_map(attrs) and is_list(cover_refs) and is_integer(revision) and
             is_integer(community_id) do
    if Enum.all?(
         [:body_bag, :cover_asset, :cover_asset_id, :cover_asset_dark, :cover_asset_dark_id],
         &(fetch_present(attrs, &1) == :missing)
       ) do
      save_with_body(
        work,
        attrs,
        actor,
        revision,
        community_id,
        {:stored, source},
        {:selected, cover_refs}
      )
    else
      {:error, :ambiguous_merge_input}
    end
  end

  defp save_with_body(work, attrs, actor, revision, community_id, body_source, cover_selection) do
    attrs = normalize_cover_attrs(attrs)

    with {:ok, :pass} <- require_transaction(),
         {:ok, article} <- lock_article(work.article_id),
         %ArticleWorkingCopy{revision: ^revision} = locked <-
           lock_save_work(work.id, article.id, body_source),
         {:ok, body_attrs} <- selected_body_attrs(body_source, attrs, article, locked),
         {:ok, tags} <- requested_tags(attrs, article, locked, community_id),
         {:ok, cover_id, retired_cover_id, cover_changed?} <- update_cover(attrs, locked),
         {:ok, typed_changed?} <- update_typed_work(locked, article.thread, attrs),
         {:ok, updated} <-
           update_work(
             locked,
             attrs,
             body_attrs,
             cover_id,
             actor
           ),
         {:ok, _} <- maybe_replace_tags(updated, attrs, tags),
         {:ok, :pass} <- delete_retired_cover(retired_cover_id),
         {:ok, _asset_refs} <-
           maybe_sync_asset_refs(
             community_id,
             article,
             updated,
             attrs,
             actor,
             changed_fields?(locked, body_attrs) or cover_changed? or typed_changed?,
             cover_selection
           ) do
      {:ok, updated}
    else
      %ArticleWorkingCopy{} -> {:error, :revision_conflict}
      nil -> {:error, :working_copy_not_found}
      {:error, %Ecto.Changeset{} = changeset} -> normalize_save_changeset(changeset)
      {:error, _reason} = error -> error
    end
  end

  defp selected_body_attrs(:input, attrs, article, locked) do
    optional_body_attrs(attrs, article.thread, locked)
  end

  defp selected_body_attrs({:stored, source}, _attrs, %Article{thread: :doc} = article, locked) do
    with {:ok, saved} <- lock_body_source(source, locked),
         true <- saved.article_id == article.id do
      {:ok, Map.take(saved, @body_fields)}
    else
      false -> {:error, :body_source_owner_mismatch}
      {:error, _reason} = error -> error
    end
  end

  defp selected_body_attrs({:stored, _source}, _attrs, _article, _locked) do
    {:error, :unsupported_article_thread}
  end

  defp lock_body_source(%ArticleSnapshot{id: id}, locked) when is_binary(id) do
    case Repo.one(
           from(snapshot in ArticleSnapshot,
             where: snapshot.id == ^id and snapshot.article_id == ^locked.article_id,
             lock: "FOR SHARE"
           )
         ) do
      %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
      nil -> {:error, :body_source_owner_mismatch}
    end
  end

  defp lock_body_source(%ArticleWorkingCopy{id: id, revision: revision}, locked)
       when is_binary(id) and is_integer(revision) do
    current =
      if id == locked.id do
        locked
      else
        Repo.one(
          from(work in ArticleWorkingCopy,
            where: work.id == ^id and work.article_id == ^locked.article_id,
            lock: "FOR UPDATE"
          )
        )
      end

    case current do
      %ArticleWorkingCopy{revision: ^revision} = work -> {:ok, work}
      %ArticleWorkingCopy{} -> {:error, :source_revision_conflict}
      nil -> {:error, :body_source_owner_mismatch}
    end
  end

  defp lock_body_source(_source, _locked), do: {:error, :invalid_body_source}

  defp insert_work(article, attrs, body, cover_id, actor) do
    body_attrs = body_document_attrs(body)

    values =
      attrs
      |> take(@work_fields)
      |> Map.put_new(:digest, body.digest)
      |> Map.merge(body_attrs)
      |> Map.merge(%{
        article_id: article.id,
        scope_kind: fetch!(attrs, :scope_kind),
        scope_id: fetch!(attrs, :scope_id),
        revision: 1,
        cover_edit_working_copy_id: cover_id,
        created_by_id: actor.id,
        updated_by_id: actor.id
      })

    %ArticleWorkingCopy{} |> ArticleWorkingCopy.changeset(values) |> Repo.insert()
  end

  defp update_work(work, attrs, body_attrs, cover_id, actor) do
    metadata = take(attrs, @work_fields)
    changes = Map.merge(metadata, body_attrs) |> Map.put(:cover_edit_working_copy_id, cover_id)

    work
    |> ArticleWorkingCopy.changeset(
      Map.merge(changes, %{revision: work.revision + 1, updated_by_id: actor.id})
    )
    |> Repo.update()
  end

  defp insert_typed_work(work, thread, attrs) do
    case typed_extension(thread) do
      nil ->
        {:ok, nil}

      {model, fields} ->
        values = take(attrs, fields) |> Map.put(:working_copy_id, work.id)
        model |> struct() |> model.changeset(values) |> Repo.insert()
    end
  end

  defp update_typed_work(work, thread, attrs) do
    case typed_extension(thread) do
      nil ->
        {:ok, false}

      {model, fields} ->
        patch = take(attrs, fields)

        if map_size(patch) == 0 do
          {:ok, false}
        else
          row =
            Repo.one(
              from(row in model, where: row.working_copy_id == ^work.id, lock: "FOR UPDATE")
            )

          case row do
            nil ->
              {:error, :working_copy_thread_fields_not_found}

            row ->
              if changed_fields?(row, patch) do
                case row |> model.changeset(patch) |> Repo.update() do
                  {:ok, _updated} -> {:ok, true}
                  {:error, _changeset} = error -> error
                end
              else
                {:ok, false}
              end
          end
        end
    end
  end

  defp typed_extension(:post),
    do: {ArticleWorkingCopyPost, ~w(copy_right link_addr cover_url cover_url_dark)a}

  defp typed_extension(:blog),
    do: {ArticleWorkingCopyBlog, ~w(copy_right link_addr cover_url cover_url_dark)a}

  defp typed_extension(:changelog),
    do: {ArticleWorkingCopyChangelog, ~w(copy_right link_addr cover_url cover_url_dark)a}

  defp typed_extension(:doc),
    do: {ArticleWorkingCopyDoc, ~w(subtitle link_addr template_key cover_url cover_url_dark)a}

  defp typed_extension(:ticket), do: nil

  defp changed_fields?(work, changes) do
    Enum.any?(changes, fn {key, value} -> Map.get(work, key) != value end)
  end

  defp lock_article(article_id) do
    case Repo.one(from(article in Article, where: article.id == ^article_id, lock: "FOR UPDATE")) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :article_not_found}
    end
  end

  defp lock_save_work(id, article_id, {:stored, %ArticleWorkingCopy{id: source_id}})
       when is_binary(source_id) do
    ids = Enum.uniq([id, source_id])

    Repo.all(
      from(work in ArticleWorkingCopy,
        where: work.article_id == ^article_id and work.id in ^ids,
        order_by: [asc: work.id],
        lock: "FOR UPDATE"
      )
    )
    |> Enum.find(&(&1.id == id))
  end

  defp lock_save_work(id, article_id, _body_source) do
    Repo.one(
      from(work in ArticleWorkingCopy,
        where: work.id == ^id and work.article_id == ^article_id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp cast_body(attrs, thread) do
    input = fetch(attrs, :body_bag) || BodyBag.empty_doc()
    BodyBag.cast(input, thread: thread, allow_empty: true)
  end

  defp optional_body_attrs(attrs, thread, _current) do
    case fetch(attrs, :body_bag) do
      nil ->
        {:ok, %{}}

      input ->
        with {:ok, body} <- BodyBag.cast(input, thread: thread, allow_empty: true) do
          {:ok, body_document_attrs(body)}
        end
    end
  end

  defp body_document_attrs(body) do
    generated = BodyBag.to_document_attrs(body)

    %{
      body_json: generated.json,
      body_schema_version: generated.schema_version,
      body_markdown: generated.markdown,
      body_html: generated.html,
      body_markdown_toc: generated.markdown_toc,
      body_plain_text: generated.plain_text,
      body_thumbnail: generated.thumbnail,
      body_xml: nil,
      body_rss: nil
    }
  end

  defp maybe_sync_asset_refs(
         community_id,
         article,
         work,
         attrs,
         actor,
         content_changed?,
         cover_selection
       ) do
    explicit_ref_change? =
      Enum.any?(
        [:asset_refs, :cover_asset, :cover_asset_id, :cover_asset_dark, :cover_asset_dark_id],
        &(fetch_present(attrs, &1) != :missing)
      )

    case cover_selection do
      {:selected, refs} ->
        AssetRefs.sync_merged_working_copy_refs(
          %CMS.Model.Community{id: community_id},
          article,
          work,
          attrs,
          refs,
          actor
        )

      :derived ->
        if content_changed? or explicit_ref_change? do
          sync_asset_refs(community_id, article, work, attrs, actor)
        else
          {:ok, :unchanged}
        end
    end
  end

  defp sync_asset_refs(community_id, article, work, attrs, actor) do
    AssetRefs.sync_working_copy_refs(
      %CMS.Model.Community{id: community_id},
      article,
      work,
      attrs,
      actor
    )
  end

  defp requested_tags(attrs, article, current, community_id) do
    case fetch(attrs, :tag_ids) do
      nil when is_struct(current, ArticleWorkingCopy) -> {:ok, nil}
      nil -> {:ok, []}
      ids when is_list(ids) -> validate_tags(article, community_id, ids)
      _ -> {:error, :invalid_tag}
    end
  end

  defp validate_tags(_article, _community_id, []), do: {:ok, []}

  defp validate_tags(%Article{thread: thread}, community_id, ids)
       when is_integer(community_id) and is_list(ids) do
    ids = Enum.uniq(ids)

    tags =
      Repo.all(
        from(tag in CommunityTag,
          where: tag.id in ^ids and tag.community_id == ^community_id and tag.thread == ^thread
        )
      )

    if length(tags) == length(ids), do: {:ok, tags}, else: {:error, :invalid_tag}
  end

  defp validate_tags(_article, _community_id, _ids), do: {:error, :invalid_tag}

  defp create_cover(attrs) do
    case fetch(attrs, :cover_edit) do
      nil -> {:ok, nil}
      values when is_map(values) -> insert_cover(values)
      _ -> {:error, :invalid_cover_edit}
    end
  end

  defp update_cover(attrs, %ArticleWorkingCopy{cover_edit_working_copy_id: old_id}) do
    case fetch_present(attrs, :cover_edit) do
      :missing ->
        {:ok, old_id, nil, false}

      {:present, nil} ->
        {:ok, nil, old_id, old_id != nil}

      {:present, values} when is_map(values) ->
        case old_id && Repo.get(CoverEditWorkingCopy, old_id) do
          %CoverEditWorkingCopy{} = cover ->
            changes = take(values, @cover_fields)

            if changed_fields?(cover, changes) do
              with {:ok, updated} <-
                     cover |> CoverEditWorkingCopy.changeset(changes) |> Repo.update() do
                {:ok, updated.id, nil, true}
              end
            else
              {:ok, cover.id, nil, false}
            end

          nil ->
            with {:ok, id} <- insert_cover(values) do
              {:ok, id, nil, true}
            end
        end

      _ ->
        {:error, :invalid_cover_edit}
    end
  end

  defp insert_cover(attrs) do
    case %CoverEditWorkingCopy{}
         |> CoverEditWorkingCopy.changeset(take(attrs, @cover_fields))
         |> Repo.insert() do
      {:ok, cover} -> {:ok, cover.id}
      {:error, _changeset} = error -> error
    end
  end

  defp normalize_cover_attrs(attrs) do
    case fetch_present(attrs, :cover_edit) do
      :missing ->
        case fetch_present(attrs, :cover_edit_info) do
          {:present, nil} -> Map.put(attrs, :cover_edit, nil)
          {:present, cover} when is_map(cover) -> Map.put(attrs, :cover_edit, cover)
          _ -> attrs
        end

      _ ->
        attrs
    end
    |> normalize_cover_format_version()
  end

  defp normalize_cover_format_version(%{cover_edit: cover} = attrs) when is_map(cover),
    do: Map.put_new(cover, :format_version, 1) |> then(&Map.put(attrs, :cover_edit, &1))

  defp normalize_cover_format_version(attrs), do: attrs

  defp replace_tags(work, tags) do
    Repo.delete_all(from(tag in ArticleWorkingCopyTag, where: tag.working_copy_id == ^work.id))

    Enum.reduce_while(tags, {:ok, :pass}, fn tag, {:ok, _} ->
      case %ArticleWorkingCopyTag{}
           |> ArticleWorkingCopyTag.changeset(%{working_copy_id: work.id, tag_id: tag.id})
           |> Repo.insert() do
        {:ok, _row} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp maybe_replace_tags(_work, _attrs, nil), do: {:ok, :unchanged}

  defp maybe_replace_tags(work, _attrs, tags) do
    requested_tag_ids = Enum.map(tags, & &1.id) |> Enum.sort()

    if tag_ids(work) == requested_tag_ids,
      do: {:ok, :unchanged},
      else: replace_tags(work, tags)
  end

  defp tag_ids(work) do
    Repo.all(
      from(tag in ArticleWorkingCopyTag,
        where: tag.working_copy_id == ^work.id,
        select: tag.tag_id,
        order_by: tag.tag_id
      )
    )
  end

  defp delete_retired_cover(nil), do: {:ok, :pass}

  defp delete_retired_cover(id) do
    case Repo.get(CoverEditWorkingCopy, id) do
      nil ->
        {:ok, :pass}

      %CoverEditWorkingCopy{} = cover ->
        case Repo.delete(cover) do
          {:ok, _} -> {:ok, :pass}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp take(map, fields),
    do: Map.take(map, fields) |> then(&Map.merge(&1, string_keys(map, fields)))

  defp string_keys(map, fields) do
    Enum.reduce(fields, %{}, fn field, acc ->
      case Map.fetch(map, Atom.to_string(field)) do
        {:ok, value} -> Map.put(acc, field, value)
        :error -> acc
      end
    end)
  end

  defp fetch(map, field), do: Map.get(map, field, Map.get(map, Atom.to_string(field)))

  defp fetch!(map, field) do
    case fetch_present(map, field) do
      {:present, value} -> value
      :missing -> raise KeyError, key: field, term: map
    end
  end

  defp fetch_present(map, field) do
    case Map.fetch(map, field) do
      {:ok, value} ->
        {:present, value}

      :error ->
        case Map.fetch(map, Atom.to_string(field)) do
          {:ok, value} -> {:present, value}
          :error -> :missing
        end
    end
  end

  defp require_transaction do
    if Repo.in_transaction?(), do: {:ok, :pass}, else: {:error, :transaction_required}
  end

  defp normalize_create_changeset(%Ecto.Changeset{} = changeset) do
    cond do
      Enum.any?(changeset.errors, fn {_field, {_message, meta}} ->
        meta[:constraint] == :unique
      end) ->
        {:error, :scope_occupied}

      changeset.data.__struct__ == ArticleWorkingCopy ->
        {:error, :invalid_working_copy}

      true ->
        {:error, :invalid_content}
    end
  end

  defp normalize_save_changeset(%Ecto.Changeset{data: %ArticleWorkingCopy{}}),
    do: {:error, :invalid_content}

  defp normalize_save_changeset(%Ecto.Changeset{}), do: {:error, :invalid_content}
end
