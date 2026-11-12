defmodule GroupherServer.CMS.DocTree.Publication.Notifications do
  @moduledoc """
  Captures approval transitions transactionally and delivers status-only notices.

      Queue write -> Outbox + captured participants -> retryable worker -> recipient notices

  Reads never emit notices. No authored content is included; each read rechecks
  site preview admission. Delivery failure does not undo an approval or release.
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User

  alias CMS.Model.{
    DocsPublishApproval,
    DocsPublishApprovalContributor,
    DocsQueueArticleContributor,
    DocsQueueTreeContributor,
    DocsPublicationNotification
  }

  @doc "Registers an approved notice to the captured queue participants."
  def approved(queue) do
    emit(queue, "approved", recipients(queue))
  end

  @doc "Registers invalidation only when a previously current approval stops matching."
  def changed(old, updated) do
    approval =
      if old.latest_approval_id, do: Repo.get(DocsPublishApproval, old.latest_approval_id)

    if approval && old.approval_required && approval.queue_revision == old.queue_revision &&
         approval.approval_policy_revision == old.approval_policy_revision &&
         (old.queue_revision != updated.queue_revision or
            old.approval_policy_revision != updated.approval_policy_revision) &&
         old.public_release_id == updated.public_release_id do
      emit(
        updated,
        if(updated.approval_required, do: "pending", else: "disabled"),
        recipients(old)
      )
    else
      {:ok, :unchanged}
    end
  end

  defp recipients(queue) do
    current =
      Repo.all(
        from(c in DocsQueueArticleContributor, where: c.queue_id == ^queue.id, select: c.user_id)
      ) ++
        Repo.all(
          from(c in DocsQueueTreeContributor, where: c.queue_id == ^queue.id, select: c.user_id)
        )

    prior =
      if queue.latest_approval_id do
        Repo.all(
          from(c in DocsPublishApprovalContributor,
            where: c.approval_id == ^queue.latest_approval_id,
            select: c.user_id
          )
        )
      else
        []
      end

    approver =
      if queue.latest_approval_id do
        case Repo.get(DocsPublishApproval, queue.latest_approval_id) do
          %{approved_by_id: id} -> [id]
          _ -> []
        end
      else
        []
      end

    Enum.sort(Enum.uniq(current ++ prior ++ approver))
  end

  defp emit(queue, status, recipients) do
    CMS.DocTree.Publication.Effects.notify(queue, status, recipients)
  end

  @doc "Delivers a claimed event idempotently without exposing document content."
  def deliver(%{event: "docs.approval_status", data: data} = event) do
    Repo.transact(fn ->
      now = DateTime.truncate(event.inserted_at, :second)
      site = Repo.get(CMS.Model.Community, data["community_id"])
      recipients = Repo.all(from(u in User, where: u.id in ^data["recipients"], order_by: u.id))

      rows =
        recipients
        |> Enum.filter(fn actor ->
          site && match?({:ok, _}, CMS.Gate.access_check(actor, :docs_queue_preview, site))
        end)
        |> Enum.map(fn actor ->
          %{
            event_id: event.id,
            user_id: actor.id,
            community_id: data["community_id"],
            status: data["status"],
            queue_revision: data["queue_revision"],
            inserted_at: now
          }
        end)

      Repo.insert_all(DocsPublicationNotification, rows, on_conflict: :nothing)
      {:ok, :delivered}
    end)
  end

  def deliver(_), do: {:error, :invalid_docs_notification}

  @doc "Reads only the admitted actor's own notices."
  def read(site, actor) do
    CMS.DocTree.Publication.Query.snapshot(site, actor, :docs_queue_preview, fn _ ->
      rows =
        Repo.all(
          from(n in DocsPublicationNotification,
            where: n.community_id == ^site.id and n.user_id == ^actor.id,
            order_by: [desc: n.inserted_at, desc: n.event_id],
            limit: 20,
            select: map(n, [:event_id, :status, :queue_revision, :inserted_at])
          )
        )

      {:ok, %{items: rows}}
    end)
  end
end
