defmodule GroupherServer.CMS.Articles.WorkingCopy.History do
  @moduledoc """
  Appends Article history facts inside the caller's existing write transaction.

      Article lock -> sequence and previous content event -> immutable event insert

  The command owns admission, snapshots, operation identity and transaction rollback.
  Callers must acquire all needed site locks before the Article lock.
  """

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.WorkingCopy.{Diff, Snapshotter}
  alias CMS.Model.{Article, ArticleWorkingCopy}
  alias CMS.Articles.WorkingCopy.Persist
  alias Accounts.Model.User

  @doc "Builds attribution from a trusted domain actor and request provenance."
  def event_attrs(%User{} = actor, operation_ref, community_id, origin, operation_index) do
    %{
      actor_type: :user,
      actor_id: actor.id,
      source: origin.source,
      service_ref: origin.service_ref,
      source_community_id: community_id,
      occurred_at: DateTime.utc_now() |> DateTime.truncate(:second),
      operation_ref: operation_ref,
      causation_command_id: Map.get(origin, :causation_command_id),
      operation_index: operation_index
    }
  end

  @doc "Records the initial state of a created or forked WorkingCopy in the caller transaction."
  def record_initial_in_transaction(
        %Article{id: article_id} = article,
        %ArticleWorkingCopy{article_id: article_id} = work,
        actor,
        operation_ref,
        %{type: type} = event_attrs
      )
      when is_binary(operation_ref) and type in [:create, :fork] and
             (is_struct(actor, User) or actor == :system) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, :pass} <- validate_identity(actor, operation_ref, event_attrs),
         {:ok, snapshot} <-
           Snapshotter.freeze_in_transaction(
             work.id,
             work.revision,
             actor,
             Map.get(event_attrs, :causation_command_id)
           ),
         {:ok, event} <-
           append_in_transaction(
             article,
             Map.merge(event_attrs, %{
               actor_snapshot: actor_snapshot(actor),
               working_copy_id: work.id,
               after_revision: work.revision,
               after_snapshot_id: snapshot.id
             })
           ) do
      {:ok, event}
    end
  end

  defp actor_snapshot(%User{} = actor) do
    %{login: actor.login, nickname: actor.nickname, avatar: actor.avatar}
  end

  defp actor_snapshot(:system), do: %{type: "system"}

  @doc "Records a changed Public Snapshot selection after the caller locks and selects Public."
  def record_publish_in_transaction(
        %Article{} = article,
        before_snapshot_id,
        after_snapshot_id,
        actor,
        operation_ref,
        event_attrs
      )
      when (is_struct(actor, User) or actor == :system) and is_binary(after_snapshot_id) and
             is_binary(operation_ref) and is_map(event_attrs) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, :pass} <- validate_identity(actor, operation_ref, event_attrs) do
      if before_snapshot_id == after_snapshot_id do
        {:ok, :unchanged}
      else
        append_in_transaction(
          article,
          Map.merge(event_attrs, %{
            type: :publish,
            actor_snapshot: actor_snapshot(actor),
            before_snapshot_id: before_snapshot_id,
            after_snapshot_id: after_snapshot_id
          })
        )
      end
    end
  end

  @doc "Freezes and records a saved edit in the transaction that owns the write."
  def record_save_in_transaction(
        %Article{id: article_id} = article,
        %ArticleWorkingCopy{article_id: article_id} = work,
        actor,
        operation_ref,
        event_attrs,
        save
      )
      when is_binary(operation_ref) and is_map(event_attrs) and is_function(save, 0) and
             (is_struct(actor, User) or actor == :system) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, :pass} <- validate_identity(actor, operation_ref, event_attrs),
         {:ok, :pass} <- validate_save_type(event_attrs),
         {:ok, before} <-
           Snapshotter.freeze_in_transaction(
             work.id,
             work.revision,
             actor,
             Map.get(event_attrs, :causation_command_id)
           ),
         {:ok, saved} <- save.(),
         {:ok, diff} <- Diff.compare(before.id, saved.id),
         {:ok, :pass} <-
           record_if_changed(
             article,
             work,
             saved,
             before,
             diff,
             actor,
             event_attrs
           ) do
      {:ok, saved}
    end
  end

  defp validate_save_type(%{type: :restore, source_snapshot_id: source}) when is_binary(source) do
    {:ok, :pass}
  end

  defp validate_save_type(%{type: :edit}), do: {:ok, :pass}
  defp validate_save_type(attrs) when not is_map_key(attrs, :type), do: {:ok, :pass}
  defp validate_save_type(_attrs), do: {:error, :invalid_history_event}

  defp validate_identity(%User{id: actor_id}, operation_ref, attrs) when is_map(attrs) do
    if attrs.actor_type == :user and attrs.actor_id == actor_id and
         attrs.operation_ref == operation_ref do
      {:ok, :pass}
    else
      {:error, :history_identity_mismatch}
    end
  end

  defp validate_identity(:system, operation_ref, attrs) when is_map(attrs) do
    if attrs.actor_type == :system and is_nil(attrs.actor_id) and
         attrs.operation_ref == operation_ref do
      {:ok, :pass}
    else
      {:error, :history_identity_mismatch}
    end
  end

  defp validate_identity(_actor, _command_id, _attrs), do: {:error, :history_identity_mismatch}

  defp record_if_changed(article, work, saved, before, diff, actor, event_attrs) do
    changed? =
      not diff.body.equal or map_size(diff.fields) > 0 or diff.tags.added != [] or
        diff.tags.removed != [] or diff.cover_edit or diff.asset_refs

    if changed? do
      with {:ok, after_snapshot} <-
             Snapshotter.freeze_in_transaction(
               saved.id,
               saved.revision,
               actor,
               Map.get(event_attrs, :causation_command_id)
             ),
           {:ok, _event} <-
             append_in_transaction(
               article,
               Map.merge(event_attrs, %{
                 type: Map.get(event_attrs, :type, :edit),
                 actor_snapshot: actor_snapshot(actor),
                 working_copy_id: saved.id,
                 before_revision: work.revision,
                 after_revision: saved.revision,
                 before_snapshot_id: before.id,
                 after_snapshot_id: after_snapshot.id
               })
             ) do
        {:ok, :pass}
      end
    else
      {:ok, :pass}
    end
  end

  @doc "Appends one event after taking the Article lock in the caller transaction."
  def append_in_transaction(%Article{id: article_id}, attrs) when is_map(attrs) do
    Persist.append_article_event_in_transaction(article_id, attrs)
  end

  defp require_transaction do
    Persist.require_transaction()
  end
end
