defmodule GroupherServer.CMS.Articles.Revision.Cleanup do
  @moduledoc """
  Deletes expired ordinary Revisions only after proving they are unreachable.

      expired Revision -> reference checks -> delete revision -> orphan body cleanup

  DocBranchVersion references are permanent roots and therefore always block
  deletion. Cleanup processes bounded batches so the daily job is resumable.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    ArticleBodySnapshot,
    ArticleDraft,
    ArticlePublic,
    ArticleRevision,
    CoverBackground,
    DraftCoverEdit,
    DocBranchVersion,
    DocDraft,
    RevisionCoverEdit
  }

  @default_batch_size 100

  @doc "Deletes one bounded batch of expired, unreferenced Revisions and orphan body snapshots."
  @spec run(keyword()) :: {:ok, non_neg_integer()} | {:error, term()}
  def run(opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())
    batch_size = Keyword.get(opts, :batch_size, @default_batch_size)

    Repo.transaction(fn ->
      revisions =
        ArticleRevision
        |> where([revision], revision.cleanup_after <= ^now)
        |> join(:left, [revision], public in ArticlePublic, on: public.revision_id == revision.id)
        |> join(:left, [revision], draft in ArticleDraft,
          on: draft.base_revision_id == revision.id
        )
        |> join(:left, [revision], doc_draft in DocDraft,
          on:
            doc_draft.base_revision_id == revision.id or
              doc_draft.source_revision_id == revision.id
        )
        |> join(:left, [revision], version in DocBranchVersion,
          on: version.revision_id == revision.id
        )
        |> where(
          [_revision, public, draft, doc_draft, version],
          is_nil(public.article_id) and is_nil(draft.article_id) and is_nil(doc_draft.id) and
            is_nil(version.id)
        )
        |> order_by([revision], asc: revision.cleanup_after, asc: revision.id)
        |> limit(^batch_size)
        |> lock("FOR UPDATE SKIP LOCKED")
        |> Repo.all()

      body_ids = Enum.map(revisions, & &1.body_snapshot_id)
      background_ids = revision_background_ids(revisions)
      Enum.each(revisions, &Repo.delete!/1)
      delete_orphan_bodies(body_ids)
      delete_orphan_cover_backgrounds(background_ids)
      length(revisions)
    end)
  end

  defp delete_orphan_bodies([]), do: :ok

  defp delete_orphan_bodies(body_ids) do
    ArticleBodySnapshot
    |> where([body], body.id in ^body_ids)
    |> join(:left, [body], revision in ArticleRevision, on: revision.body_snapshot_id == body.id)
    |> where([_body, revision], is_nil(revision.id))
    |> Repo.delete_all()

    :ok
  end

  defp revision_background_ids([]), do: []

  defp revision_background_ids(revisions) do
    revision_ids = Enum.map(revisions, & &1.id)

    Enum.flat_map(
      [
        :light_background_id,
        :light_original_background_id,
        :dark_background_id,
        :dark_original_background_id
      ],
      fn field ->
        Repo.all(
          from(edit in RevisionCoverEdit,
            where: edit.revision_id in ^revision_ids,
            select: field(edit, ^field)
          )
        )
      end
    )
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp delete_orphan_cover_backgrounds([]), do: :ok

  defp delete_orphan_cover_backgrounds(background_ids) do
    from(background in CoverBackground,
      left_join: draft in DraftCoverEdit,
      on:
        draft.light_background_id == background.id or
          draft.light_original_background_id == background.id or
          draft.dark_background_id == background.id or
          draft.dark_original_background_id == background.id,
      left_join: revision in RevisionCoverEdit,
      on:
        revision.light_background_id == background.id or
          revision.light_original_background_id == background.id or
          revision.dark_background_id == background.id or
          revision.dark_original_background_id == background.id,
      where:
        background.id in ^background_ids and is_nil(draft.body_draft_id) and
          is_nil(revision.revision_id),
      select: background.id
    )
    |> Repo.delete_all()

    :ok
  end
end
