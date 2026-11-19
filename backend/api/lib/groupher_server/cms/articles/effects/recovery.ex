defmodule GroupherServer.CMS.Articles.Effects.Recovery do
  @moduledoc """
  Derives whether a failed, pure Article projection has a committed replacement.

      failed effect -> matching publish History or sealed Release lineage
        -> same resource, binding and complete effect intent -> pending / superseded

  This is a read of existing facts. It never resets an event, discards a
  notification, or persists a second alert or replacement state machine.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleEvent, DocsRelease, DocsReleaseArticle}
  alias CMS.Outbox.Event

  @doc "Returns the current failure diagnosis without mutating the original intent."
  def status(%Event{status: :failed, contract_version: 1, resource_type: "article"} = event) do
    with {:ok, kinds} <- replacement_kinds(event),
         {:ok, :pass} <- CMS.Outbox.validate_event_contract(event),
         true <- valid_scope?(event),
         {:ok, replacement} <- replacement(event, kinds),
         {:ok, :pass} <- replacement_contract(replacement) do
      {:ok,
       %{
         outcome: :superseded,
         event_id: event.id,
         superseded_by: replacement.id,
         replacement_status: replacement.status
       }}
    else
      :unproven -> pending(event)
      false -> pending(event)
      {:error, _reason} = error -> error
    end
  end

  def status(%Event{} = event), do: pending(event)

  defp replacement_contract(replacement) do
    case CMS.Outbox.validate_event_contract(replacement) do
      {:ok, :pass} -> {:ok, :pass}
      {:error, _reason} -> :unproven
    end
  end

  defp pending(event), do: {:ok, %{outcome: :pending, event_id: event.id}}

  defp replacement_kinds(%{event: kind, worker: "GroupherServer.Jobs.CMSOutboxArticle"})
       when kind in ["article.published", "article.updated"] do
    {:ok, ["article.published", "article.updated"]}
  end

  defp replacement_kinds(%{
         event: "article.projections",
         worker: "GroupherServer.Jobs.CMSOutboxArticle"
       }) do
    {:ok, ["article.projections"]}
  end

  defp replacement_kinds(%{event: kind, worker: worker, data: %{"source_event" => source}})
       when source in ["article.published", "article.updated"] and
              ((kind == "article.search_sync" and worker == "GroupherServer.Jobs.CMSOutboxSearch") or
                 (kind == "article.cdn_purge" and worker == "GroupherServer.Jobs.CMSOutboxCDN")) do
    {:ok, [kind]}
  end

  defp replacement_kinds(_event), do: :unproven

  defp replacement(%{data: %{"release_id" => id}} = event, kinds) when is_integer(id) do
    docs_replacement(event, kinds, id)
  end

  defp replacement(%{data: data} = event, kinds) do
    if Map.has_key?(data, "release_id") do
      :unproven
    else
      ordinary_replacement(event, kinds)
    end
  end

  defp valid_scope?(event) do
    is_integer(event.data["community_id"]) and is_integer(event.data["inner_id"]) and
      match?({:ok, _}, Ecto.UUID.cast(event.resource_id)) and
      match?({:ok, _}, Ecto.UUID.cast(event.data["snapshot_id"]))
  end

  defp candidates(event, kinds) do
    from(replacement in Event,
      where: replacement.id != ^event.id and replacement.resource_type == "article",
      where: replacement.resource_id == ^event.resource_id and replacement.event in ^kinds,
      where: replacement.contract_version == 1 and replacement.worker == ^event.worker,
      where:
        fragment("?->>'community_id'", replacement.data) == ^to_string(event.data["community_id"]),
      where: fragment("?->>'inner_id'", replacement.data) == ^to_string(event.data["inner_id"])
    )
  end

  defp ordinary_replacement(event, kinds) do
    old =
      Repo.one(
        from(history in ArticleEvent,
          where:
            history.article_id == ^event.resource_id and
              history.operation_ref == ^event.operation_ref,
          where:
            history.type == :publish and
              history.source_community_id == ^event.data["community_id"],
          where: fragment("?::text", history.after_snapshot_id) == ^event.data["snapshot_id"],
          order_by: [desc: history.sequence],
          limit: 1
        )
      )

    case old do
      %ArticleEvent{} ->
        candidates(event, kinds)
        |> join(:inner, [effect], history in ArticleEvent,
          on:
            history.article_id == type(effect.resource_id, Ecto.UUID) and
              history.operation_ref == effect.operation_ref
        )
        |> where([effect, history], history.type == :publish and history.sequence > ^old.sequence)
        |> where([effect, history], history.source_community_id == ^old.source_community_id)
        |> where(
          [effect, history],
          fragment("?::text", history.after_snapshot_id) ==
            fragment("?->>'snapshot_id'", effect.data)
        )
        |> where([effect], is_nil(fragment("?->>'release_id'", effect.data)))
        |> order_by([_effect, history], desc: history.sequence)
        |> limit(1)
        |> Repo.one()
        |> found()

      nil ->
        :unproven
    end
  end

  defp docs_replacement(event, kinds, release_id) do
    old_member? =
      Repo.exists?(
        from(release in DocsRelease,
          join: member in DocsReleaseArticle,
          on: member.release_id == release.id,
          where:
            release.id == ^release_id and release.sealed and
              release.community_id == ^event.data["community_id"],
          where: member.article_id == ^event.resource_id and member.action == :publish,
          where: fragment("?::text", member.snapshot_id) == ^event.data["snapshot_id"]
        )
      )

    if old_member? do
      base =
        from(release in DocsRelease, where: release.id == ^release_id, select: %{id: release.id})

      successors =
        from(release in DocsRelease,
          join: parent in "effect_release_lineage",
          on: release.base_release_id == parent.id,
          where:
            release.sealed and release.community_id == ^event.data["community_id"] and
              release.id > parent.id,
          select: %{id: release.id}
        )

      lineage = union_all(base, ^successors)

      candidates(event, kinds)
      |> recursive_ctes(true)
      |> with_cte("effect_release_lineage", as: ^lineage)
      |> join(:inner, [effect], release in "effect_release_lineage",
        on: fragment("?->>'release_id'", effect.data) == type(release.id, :string)
      )
      |> join(:inner, [effect, release], member in DocsReleaseArticle,
        on: member.release_id == release.id and member.article_id == ^event.resource_id
      )
      |> where([effect, release, member], release.id > ^release_id and member.action == :publish)
      |> where(
        [effect, _release, member],
        fragment("?::text", member.snapshot_id) == fragment("?->>'snapshot_id'", effect.data)
      )
      |> order_by([_effect, release], desc: release.id)
      |> limit(1)
      |> Repo.one()
      |> found()
    else
      :unproven
    end
  end

  defp found(nil), do: :unproven
  defp found(%Event{} = event), do: {:ok, event}
end
