defmodule GroupherServer.CMS.ArtimentMentions.Rebuild do
  @moduledoc """
  Scans canonical public sources and reconciles Mention watermarks.

      public heads -> checkpointed report -> locked source sync -> failure manifest
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.Model.SyncState
  alias CMS.Outbox.Event

  alias CMS.Model.{
    Article,
    ArticlePublic,
    Comment,
    CommentBody,
    CommentLifecycle,
    DocBranch,
    DocPublic,
    TicketState
  }

  def default_manifest do
    case System.get_env("MENTION_REBUILD_FAILURE_MANIFEST") do
      path when is_binary(path) and path != "" ->
        path

      _ ->
        if Application.get_env(:groupher_server, :env) == :prod do
          raise "MENTION_REBUILD_FAILURE_MANIFEST must point to persistent storage"
        else
          database = Repo.config()[:database] || "local"
          Path.join(System.tmp_dir!(), "groupher-mention-rebuild-#{database}.json")
        end
    end
  end

  def sources do
    articles =
      Repo.all(
        from(p in ArticlePublic,
          join: a in Article,
          on: a.id == p.article_id,
          left_join: t in TicketState,
          on: t.article_id == a.id,
          where: a.thread != :doc and (a.thread != :ticket or t.type == :user),
          select: {a.thread, a.id, p.revision_id, p.publication_version}
        )
      )
      |> Enum.map(fn {type, id, revision, version} ->
        {%{type: type, article_id: id}, "#{revision}:#{version}"}
      end)

    docs =
      Repo.all(
        from(p in DocPublic,
          join: b in DocBranch,
          on: b.id == p.branch_id,
          where: b.type == :main,
          select: {p.article_id, p.branch_id, p.branch_version_id, p.publication_version}
        )
      )
      |> Enum.map(fn {id, branch, version_id, version} ->
        {%{type: :doc, article_id: id, branch_id: branch}, "#{branch}:#{version_id}:#{version}"}
      end)

    comments =
      Repo.all(
        from(c in Comment,
          left_join: b in CommentBody,
          on: c.id == b.comment_id,
          join: lifecycle in CommentLifecycle,
          on: lifecycle.comment_id == c.id,
          where: lifecycle.state != :destroy,
          select: {c.id, b.version, b.body_hash}
        )
      )
      |> Enum.map(fn {id, version, hash} ->
        token = if is_nil(version) or is_nil(hash), do: nil, else: "#{id}:#{version}:#{hash}"
        {%{type: :comment, comment_id: id}, token}
      end)

    (articles ++ docs ++ comments)
    |> Enum.sort_by(fn {locator, _} -> key(locator) end)
  end

  @doc "Reads a stable, bounded page of current public sources without offset."
  def source_batch(after_key, limit) when is_integer(limit) and limit in 1..100 do
    sql = """
    SELECT source_key, source_type, article_id, comment_id, branch_id, token
    FROM (
      SELECT a.thread || ':' || a.id::text AS source_key,
             a.thread AS source_type, a.id::text AS article_id,
             NULL::bigint AS comment_id, NULL::bigint AS branch_id,
             p.revision_id::text || ':' || p.publication_version::text AS token
      FROM cms.article_publics p
      JOIN cms.articles a ON a.id = p.article_id
      LEFT JOIN cms.ticket_states ticket ON ticket.article_id = a.id
      WHERE a.thread IN ('post', 'blog', 'changelog', 'ticket')
        AND (a.thread <> 'ticket' OR ticket.type = 'user')
      UNION ALL
      SELECT 'doc:' || p.article_id::text || ':' || lpad(p.branch_id::text, 20, '0'),
             'doc', p.article_id::text, NULL::bigint, p.branch_id,
             p.branch_id::text || ':' || p.branch_version_id::text || ':' ||
               p.publication_version::text
      FROM cms.doc_publics p
      JOIN cms.doc_branches branch ON branch.id = p.branch_id AND branch.type = 'main'
      UNION ALL
      SELECT 'comment:' || lpad(c.id::text, 20, '0'),
             'comment', NULL::text, c.id, NULL::bigint,
             c.id::text || ':' || b.version::text || ':' || b.body_hash
      FROM cms.comments c
      LEFT JOIN cms.comment_bodies b ON b.comment_id = c.id
      JOIN cms.comment_lifecycles lifecycle ON lifecycle.comment_id = c.id
      WHERE lifecycle.state <> 'destroy'
    ) current_sources
    WHERE ($1::text IS NULL OR source_key > $1::text)
    ORDER BY source_key
    LIMIT $2
    """

    Repo.query!(sql, [after_key, limit])
    |> Map.fetch!(:rows)
    |> Enum.map(fn [_key, type, article_id, comment_id, branch_id, token] ->
      locator =
        case type do
          "comment" -> %{type: :comment, comment_id: comment_id}
          "doc" -> %{type: :doc, article_id: article_id, branch_id: branch_id}
          _ -> %{type: String.to_existing_atom(type), article_id: article_id}
        end

      {locator, token}
    end)
  end

  def key(%{type: :comment, comment_id: id}),
    do: "comment:#{String.pad_leading(Integer.to_string(id), 20, "0")}"

  def key(%{type: :doc, article_id: id, branch_id: branch}),
    do: "doc:#{id}:#{String.pad_leading(Integer.to_string(branch), 20, "0")}"

  def key(%{type: type, article_id: id}), do: "#{type}:#{id}"

  def report(after_key \\ nil, batch_size \\ 100) do
    entries =
      source_batch(after_key, batch_size)

    watermark_issues =
      Enum.flat_map(entries, fn {locator, token} ->
        case status(locator, token) do
          :ready -> []
          reason -> [%{source_key: key(locator), category: reason}]
        end
      end)

    source_keys = entries |> Enum.map(fn {locator, _} -> key(locator) end) |> MapSet.new()
    outbox_issues = exhausted_outbox_issues(source_keys, entries)

    manifest_issues =
      default_manifest()
      |> read_manifest()
      |> Enum.flat_map(fn {source_key, _failure} ->
        if MapSet.member?(source_keys, source_key),
          do: [%{source_key: source_key, category: :failed_manifest}],
          else: []
      end)

    issues = watermark_issues ++ outbox_issues ++ manifest_issues

    %{
      scanned: length(entries),
      issues: issues,
      checkpoint:
        case List.last(entries) do
          {locator, _} -> key(locator)
          nil -> after_key
        end,
      more: length(entries) == batch_size
    }
  end

  @doc "Reports every current source from the optional checkpoint to the end."
  def report_all(after_key \\ nil, batch_size \\ 100) do
    report_all(after_key, batch_size, 0, [])
  end

  defp report_all(after_key, batch_size, scanned, issue_chunks) do
    page = report(after_key, batch_size)
    scanned = scanned + page.scanned
    issue_chunks = [page.issues | issue_chunks]

    if page.more do
      report_all(page.checkpoint, batch_size, scanned, issue_chunks)
    else
      %{page | scanned: scanned, issues: issue_chunks |> Enum.reverse() |> List.flatten()}
    end
  end

  defp exhausted_outbox_issues(source_keys, entries) do
    resource_ids =
      Enum.map(entries, fn {locator, _} ->
        case locator do
          %{comment_id: id} -> Integer.to_string(id)
          %{article_id: id} -> id
        end
      end)

    Repo.all(
      from(e in Event,
        where:
          e.event in ["article.mention_sync", "comment.mention_sync"] and
            e.status == :failed and e.resource_id in ^resource_ids,
        select: {e.event, e.resource_id, e.data}
      )
    )
    |> Enum.flat_map(fn
      {"comment.mention_sync", id, _data} ->
        case Integer.parse(id) do
          {comment_id, ""} ->
            issue_if_current(source_keys, key(%{type: :comment, comment_id: comment_id}))

          _ ->
            []
        end

      {"article.mention_sync", id, %{"source_type" => type} = data}
      when type in ["post", "blog", "changelog", "doc", "ticket"] ->
        locator =
          if type == "doc",
            do: %{type: :doc, article_id: id, branch_id: data["branch_id"]},
            else: %{type: String.to_existing_atom(type), article_id: id}

        if type == "doc" and not is_integer(data["branch_id"]),
          do: [],
          else: issue_if_current(source_keys, key(locator))

      _ ->
        []
    end)
  end

  defp issue_if_current(source_keys, source_key) do
    if MapSet.member?(source_keys, source_key),
      do: [%{source_key: source_key, category: :exhausted_outbox}],
      else: []
  end

  def apply(after_key \\ nil, batch_size \\ 100, force \\ false, manifest_path \\ nil) do
    manifest_path = manifest_path || default_manifest()

    entries =
      source_batch(after_key, batch_size)

    failures = read_manifest(manifest_path)

    {failures, results} =
      Enum.reduce(entries, {failures, []}, fn {locator, token}, {current, results} ->
        source_key = key(locator)

        result =
          if force or status(locator, token) != :ready do
            CMS.ArtimentMentions.sync_current(locator, force: force)
          else
            {:ok, :pass}
          end

        case result do
          {:ok, _} ->
            {Map.delete(current, source_key), [%{source_key: source_key, status: :ok} | results]}

          {:error, reason} ->
            prior = Map.get(current, source_key, %{"attempts" => 0})

            failure = %{
              "source_key" => source_key,
              "category" => error_category(reason),
              "attempts" => prior["attempts"] + 1
            }

            {Map.put(current, source_key, failure),
             [%{source_key: source_key, status: :error} | results]}
        end
      end)

    write_manifest(manifest_path, failures)

    %{
      processed: length(entries),
      failures: Map.values(failures),
      results: Enum.reverse(results),
      checkpoint:
        case List.last(entries) do
          {locator, _} -> key(locator)
          nil -> after_key
        end,
      more: length(entries) == batch_size
    }
  end

  @doc "Rebuilds every current source from the optional checkpoint to the end."
  def apply_all(after_key \\ nil, batch_size \\ 100, force \\ false, manifest_path \\ nil) do
    apply_all(after_key, batch_size, force, manifest_path, 0)
  end

  defp apply_all(after_key, batch_size, force, manifest_path, processed) do
    page = apply(after_key, batch_size, force, manifest_path)
    processed = processed + page.processed

    if page.more do
      apply_all(page.checkpoint, batch_size, force, manifest_path, processed)
    else
      page |> Map.put(:processed, processed) |> Map.delete(:results)
    end
  end

  def retry_failed(manifest_path) do
    failures = read_manifest(manifest_path)

    remaining =
      Enum.reduce(failures, %{}, fn {source_key, failure}, acc ->
        case locate(source_key) do
          {:ok, locator} ->
            case CMS.ArtimentMentions.sync_current(locator) do
              {:ok, _} ->
                acc

              {:error, reason} ->
                Map.put(acc, source_key, %{
                  failure
                  | "category" => error_category(reason),
                    "attempts" => failure["attempts"] + 1
                })
            end

          :gone ->
            acc
        end
      end)

    write_manifest(manifest_path, remaining)
    %{processed: map_size(failures), failures: Map.values(remaining)}
  end

  def read_manifest(path) do
    case File.read(path) do
      {:ok, body} ->
        case Jason.decode(body) do
          {:ok, list} when is_list(list) ->
            Map.new(list, fn
              %{"source_key" => source_key, "category" => _, "attempts" => attempts} = item
              when is_binary(source_key) and is_integer(attempts) ->
                {source_key, item}

              _ ->
                raise "invalid Mention rebuild failure manifest entry"
            end)

          _ ->
            raise "invalid Mention rebuild failure manifest JSON"
        end

      {:error, :enoent} ->
        %{}

      {:error, reason} ->
        raise "cannot read Mention rebuild failure manifest: #{inspect(reason)}"
    end
  end

  defp status(%{type: :comment, comment_id: id}, token) do
    check(Repo.get_by(SyncState, source_comment_id: id), token)
  end

  defp status(%{type: :doc, article_id: id, branch_id: branch}, token) do
    check(Repo.get_by(SyncState, source_article_id: id, source_branch_id: branch), token)
  end

  defp status(%{article_id: id}, token) do
    query =
      from(s in SyncState,
        where: s.source_article_id == ^id and is_nil(s.source_branch_id)
      )

    check(Repo.one(query), token)
  end

  defp check(nil, _), do: :missing_watermark

  defp check(%SyncState{desired_content_token: desired, synced_content_token: synced}, token) do
    cond do
      desired != token -> :canonical_drift
      synced != token -> :sync_pending
      true -> :ready
    end
  end

  defp locate(source_key) do
    case String.split(source_key, ":") do
      ["comment", id] ->
        case Integer.parse(id) do
          {number, ""} -> {:ok, %{type: :comment, comment_id: number}}
          _ -> :gone
        end

      ["doc", id, branch] ->
        case Integer.parse(branch) do
          {number, ""} -> {:ok, %{type: :doc, article_id: id, branch_id: number}}
          _ -> :gone
        end

      [type, id] when type in ["post", "blog", "changelog", "ticket"] ->
        {:ok, %{type: String.to_existing_atom(type), article_id: id}}

      _ ->
        :gone
    end
  end

  defp write_manifest(path, failures) do
    File.mkdir_p!(Path.dirname(path))
    temporary = path <> ".tmp.#{System.unique_integer([:positive])}"
    File.write!(temporary, Jason.encode!(Map.values(failures), pretty: true) <> "\n")
    File.rename!(temporary, path)
  end

  defp error_category(%Jason.DecodeError{}), do: "invalid_json"
  defp error_category(%Ecto.Changeset{}), do: "invalid_changeset"
  defp error_category(%{reason: reason}) when is_atom(reason), do: Atom.to_string(reason)
  defp error_category({reason, _details}) when is_atom(reason), do: Atom.to_string(reason)
  defp error_category(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp error_category(_), do: "sync_failed"
end
