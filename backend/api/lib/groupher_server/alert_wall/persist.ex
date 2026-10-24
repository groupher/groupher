defmodule GroupherServer.AlertWall.Persist do
  @moduledoc """
  Writes AlertWall items, reports and wall actions in the caller's transaction.

      owner command -> AlertWall write -> caller commits once
  """

  import Ecto.Query

  alias GroupherServer.{AlertWall, CMS, Repo}
  alias AlertWall.Model.{Action, Item, UserReport}
  alias CMS.Model.ArtimentReview

  @report_types ~w(SPAM HARASSMENT ILLEGAL_CONTENT IMPERSONATION OTHER)

  @doc "Adds or updates one open Wall item and records an idempotent add action."
  @spec add_in_transaction(map(), Ecto.UUID.t()) :: {:ok, Item.t()} | {:error, term()}
  def add_in_transaction(attrs, operation_ref) when is_map(attrs) and is_binary(operation_ref) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, normalized} <- validate_item(attrs),
         digest <- digest(normalized),
         {:ok, :new} <- prior_action(:add, operation_ref, digest),
         {:ok, item} <- get_or_create_item(normalized),
         {:ok, item} <- update_ai_opinion(item, normalized),
         {:ok, _action} <-
           record_action(
             item,
             :add,
             normalized.owner,
             nil,
             operation_ref,
             digest,
             item_result(item)
           ) do
      {:ok, item}
    else
      {:ok, %Item{} = item} -> {:ok, item}
      {:error, _reason} = error -> error
    end
  end

  def add_in_transaction(_attrs, _operation_ref), do: {:error, AlertWall.ErrorCat.invalid_item()}

  @doc "Resolves an item while preserving its history."
  @spec resolve_in_transaction(pos_integer(), String.t(), Ecto.UUID.t(), struct() | nil) ::
          {:ok, Item.t()} | {:error, term()}
  def resolve_in_transaction(item_id, resolution, operation_ref, actor)
      when is_integer(item_id) and is_binary(resolution) and is_binary(operation_ref) do
    transition(item_id, :resolve, resolution, operation_ref, actor)
  end

  def resolve_in_transaction(item_id, resolution, operation_ref, actor, expected_version)
      when is_integer(item_id) and is_binary(resolution) and is_binary(operation_ref) and
             is_integer(expected_version) and expected_version > 0 do
    transition(item_id, :resolve, resolution, operation_ref, actor, :human, expected_version)
  end

  @doc "Supersedes an item whose owner says its subject is no longer current."
  @spec supersede_in_transaction(pos_integer(), Ecto.UUID.t(), atom()) ::
          {:ok, Item.t()} | {:error, term()}
  def supersede_in_transaction(item_id, operation_ref, source)
      when is_integer(item_id) and is_binary(operation_ref) and source in [:cms, :accounts] do
    transition(item_id, :supersede, "superseded", operation_ref, nil, source)
  end

  @doc "Creates one report attached to the item for the reported public content."
  @spec submit_report_in_transaction(map(), Ecto.UUID.t()) ::
          {:ok, UserReport.t()} | {:error, term()}
  def submit_report_in_transaction(attrs, operation_ref)
      when is_map(attrs) and is_binary(operation_ref) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, normalized} <- validate_report(attrs, operation_ref),
         {:ok, report} <- prior_report(normalized),
         {:ok, report} <-
           submit_new_report(report, normalized, operation_ref) do
      {:ok, report}
    else
      {:error, _reason} = error -> error
    end
  end

  def submit_report_in_transaction(_attrs, _operation_ref) do
    {:error, AlertWall.ErrorCat.invalid_report()}
  end

  @doc "Withdraws one reporter-owned report and returns every affected item id."
  @spec withdraw_report_in_transaction(pos_integer(), pos_integer()) ::
          {:ok, %{report: UserReport.t(), item_ids: [pos_integer()]}} | {:error, term()}
  def withdraw_report_in_transaction(report_id, reporter_id)
      when is_integer(report_id) and is_integer(reporter_id) do
    with {:ok, :pass} <- require_transaction(),
         %UserReport{} = report <- lock_report(report_id),
         true <- report.reporter_id == reporter_id,
         {:ok, updated} <- withdraw_report(report),
         item_ids <- report_item_ids(report.id) do
      {:ok, %{report: updated, item_ids: item_ids}}
    else
      nil -> {:error, AlertWall.ErrorCat.report_not_found()}
      false -> {:error, AlertWall.ErrorCat.invalid_report()}
      {:error, _reason} = error -> error
      _ -> {:error, AlertWall.ErrorCat.invalid_report()}
    end
  end

  def withdraw_report_in_transaction(_report_id, _reporter_id) do
    {:error, AlertWall.ErrorCat.invalid_report()}
  end

  @doc "Counts reports that are unresolved and still apply to one item."
  @spec active_report_count(pos_integer()) :: non_neg_integer()
  def active_report_count(item_id) when is_integer(item_id) do
    Repo.one(
      from(report in UserReport,
        where:
          report.item_id == ^item_id and is_nil(report.withdrawn_at) and
            is_nil(report.outdated_at) and is_nil(report.resolved_at),
        select: count(report.id)
      )
    ) || 0
  end

  def active_report_count(_item_id), do: 0

  @doc "Replaces one open item's complete AI opinion without creating an absent item."
  @spec replace_ai_opinion_in_transaction(map()) :: {:ok, Item.t() | :absent} | {:error, term()}
  def replace_ai_opinion_in_transaction(attrs) when is_map(attrs) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, normalized} <- validate_item(attrs) do
      case Repo.one(lock(current_item_query(normalized))) do
        %Item{} = item -> update_ai_opinion(item, normalized)
        nil -> {:ok, :absent}
      end
    end
  end

  def replace_ai_opinion_in_transaction(_attrs) do
    {:error, AlertWall.ErrorCat.invalid_item()}
  end

  @doc "Resolves an item because its CMS-owned automated suspicion was cleared."
  @spec resolve_from_cms_in_transaction(pos_integer(), String.t(), Ecto.UUID.t()) ::
          {:ok, Item.t()} | {:error, term()}
  def resolve_from_cms_in_transaction(item_id, resolution, operation_ref)
      when is_integer(item_id) and is_binary(resolution) and is_binary(operation_ref) do
    transition(item_id, :resolve, resolution, operation_ref, nil, :cms)
  end

  def resolve_from_cms_in_transaction(_item_id, _resolution, _operation_ref) do
    {:error, AlertWall.ErrorCat.invalid_item()}
  end

  @doc "Supersedes the open item created from one no-longer-current CMS request, if it exists."
  @spec supersede_ai_source_in_transaction(Ecto.UUID.t(), Ecto.UUID.t()) ::
          {:ok, :pass} | {:error, term()}
  def supersede_ai_source_in_transaction(request_id, operation_ref)
      when is_binary(request_id) and is_binary(operation_ref) do
    with {:ok, :pass} <- require_transaction(),
         items <- items_for_review_request(request_id),
         {:ok, :pass} <- supersede_items(items, operation_ref) do
      {:ok, :pass}
    end
  end

  def supersede_ai_source_in_transaction(_request_id, _operation_ref) do
    {:error, AlertWall.ErrorCat.invalid_item()}
  end

  @doc "Supersedes open items for a target being permanently deleted."
  def mark_target_deleted_in_transaction(target_type, target_id, operation_ref)
      when target_type in [:article, :comment, :doc] and is_binary(target_id) and
             is_binary(operation_ref) do
    with {:ok, :pass} <- require_transaction(),
         items <- deleted_target_items(target_type, target_id),
         {:ok, :pass} <- supersede_deleted_targets(items, operation_ref) do
      {:ok, :pass}
    end
  end

  def mark_target_deleted_in_transaction(_target_type, _target_id, _operation_ref) do
    {:error, AlertWall.ErrorCat.invalid_item()}
  end

  @doc "Tombstones open Accounts-owned user items when an account target is removed."
  def mark_account_target_deleted_in_transaction(:user, target_id, operation_ref)
      when is_binary(target_id) and is_binary(operation_ref) do
    with {:ok, :pass} <- require_transaction(),
         items <- deleted_account_target_items(target_id),
         {:ok, :pass} <- supersede_deleted_targets(items, operation_ref, :accounts) do
      {:ok, :pass}
    end
  end

  def mark_account_target_deleted_in_transaction(_target_type, _target_id, _operation_ref) do
    {:error, AlertWall.ErrorCat.invalid_item()}
  end

  defp deleted_account_target_items(target_id) do
    Repo.all(
      from(item in Item,
        where:
          item.owner == :accounts and item.target_type == :user and item.target_id == ^target_id and
            item.status == :open,
        order_by: [asc: item.id],
        lock: "FOR UPDATE"
      )
    )
  end

  defp deleted_target_items(:doc, target_id) do
    query =
      from(item in Item,
        where: item.owner == :cms and item.target_type == :doc and item.status == :open,
        order_by: [asc: item.id],
        lock: "FOR UPDATE"
      )

    if String.contains?(target_id, ":") do
      Repo.all(where(query, [item], item.target_id == ^target_id))
    else
      Repo.all(where(query, [item], like(item.target_id, ^"#{target_id}:%")))
    end
  end

  defp deleted_target_items(target_type, target_id) do
    Repo.all(
      from(item in Item,
        where:
          item.owner == :cms and item.target_type == ^target_type and
            item.target_id == ^target_id and item.status == :open,
        order_by: [asc: item.id],
        lock: "FOR UPDATE"
      )
    )
  end

  @doc "Resolves an open CMS item sourced from one review request, if present."
  @spec resolve_ai_source_in_transaction(Ecto.UUID.t(), String.t(), Ecto.UUID.t()) ::
          {:ok, :pass} | {:error, term()}
  def resolve_ai_source_in_transaction(request_id, resolution, operation_ref)
      when is_binary(request_id) and is_binary(resolution) and is_binary(operation_ref) do
    with {:ok, :pass} <- require_transaction(),
         items <- items_for_review_request(request_id),
         {:ok, :pass} <- resolve_items(items, resolution, operation_ref) do
      {:ok, :pass}
    end
  end

  def resolve_ai_source_in_transaction(_request_id, _resolution, _operation_ref) do
    {:error, AlertWall.ErrorCat.invalid_item()}
  end

  defp transition(
         item_id,
         action,
         resolution,
         operation_ref,
         actor,
         source \\ :human,
         expected_version \\ nil
       ) do
    with {:ok, :pass} <- require_transaction(),
         %Item{} = item <- lock_item(item_id),
         digest <-
           digest(%{
             item_id: item_id,
             action: action,
             resolution: resolution,
             expected_version: expected_version
           }),
         {:ok, :new} <- prior_action(action, operation_ref, digest),
         {:ok, :pass} <- validate_transition(item, action, expected_version),
         {:ok, updated} <- update_item_status(item, action, resolution),
         {:ok, :pass} <- update_report_status(updated, action, resolution),
         {:ok, _record} <-
           record_action(
             updated,
             action,
             source,
             actor,
             operation_ref,
             digest,
             item_result(updated)
           ) do
      {:ok, updated}
    else
      {:ok, %Item{} = item} -> {:ok, item}
      nil -> {:error, AlertWall.ErrorCat.item_not_found()}
      {:error, _reason} = error -> error
    end
  end

  defp validate_transition(%Item{status: :open, version: version}, :resolve, nil)
       when is_integer(version),
       do: {:ok, :pass}

  defp validate_transition(%Item{status: :open, version: expected}, :resolve, expected),
    do: {:ok, :pass}

  defp validate_transition(%Item{status: :open}, :supersede, _expected_version),
    do: {:ok, :pass}

  defp validate_transition(_item, _action, _expected_version),
    do: {:error, AlertWall.ErrorCat.invalid_item()}

  defp update_item_status(%Item{} = item, :resolve, resolution) do
    if item.status == :open do
      item
      |> Item.changeset(%{
        status: :resolved,
        resolved_at: DateTime.utc_now(:second),
        resolution: resolution,
        version: item.version + 1
      })
      |> Repo.update()
    else
      {:error, AlertWall.ErrorCat.invalid_item()}
    end
  end

  defp update_item_status(%Item{} = item, :supersede, _resolution) do
    if item.status == :open do
      item
      |> Item.changeset(%{status: :superseded, version: item.version + 1})
      |> Repo.update()
    else
      {:error, AlertWall.ErrorCat.invalid_item()}
    end
  end

  defp update_report_status(%Item{} = item, :resolve, resolution) do
    now = DateTime.utc_now(:second)

    Repo.update_all(
      from(report in UserReport,
        where: report.item_id == ^item.id and is_nil(report.resolved_at)
      ),
      set: [resolved_at: now, resolution: resolution, updated_at: now]
    )

    {:ok, :pass}
  end

  defp update_report_status(%Item{} = item, :supersede, _resolution) do
    now = DateTime.utc_now(:second)

    Repo.update_all(
      from(report in UserReport,
        where: report.item_id == ^item.id and is_nil(report.outdated_at)
      ),
      set: [outdated_at: now, updated_at: now]
    )

    {:ok, :pass}
  end

  defp get_or_create_item(attrs) do
    query = current_item_query(attrs)

    case Repo.one(query) do
      %Item{} = item ->
        {:ok, item}

      nil ->
        item_attrs =
          attrs
          |> Map.take([
            :owner,
            :target_type,
            :target_id,
            :community_id,
            :subject_ref,
            :ai_source_ref,
            :sus_notes,
            :summary
          ])
          |> Map.merge(%{status: :open, version: 1, opened_at: DateTime.utc_now(:second)})

        case Repo.insert(Item.changeset(%Item{}, item_attrs), on_conflict: :nothing) do
          {:ok, %Item{id: id} = item} when not is_nil(id) ->
            {:ok, item}

          {:ok, _item} ->
            case Repo.one(query) do
              %Item{} = item -> {:ok, item}
              nil -> {:error, AlertWall.ErrorCat.invalid_item()}
            end

          {:error, _reason} = error ->
            error
        end
    end
  end

  defp items_for_review_request(request_id) do
    case Repo.get(ArtimentReview, request_id) do
      %ArtimentReview{} = request ->
        target_id = review_target_id(request)

        Repo.all(
          from(item in Item,
            where:
              item.owner == :cms and item.target_type == ^request.target_type and
                item.target_id == ^target_id and item.subject_ref == ^request.subject_ref and
                item.status == :open,
            order_by: [asc: item.id],
            lock: "FOR UPDATE"
          )
        )

      nil ->
        []
    end
  end

  defp review_target_id(%ArtimentReview{target_type: :article, article_id: id}), do: id
  defp review_target_id(%ArtimentReview{target_type: :comment, comment_id: id}), do: to_string(id)

  defp review_target_id(%ArtimentReview{target_type: :doc, article_id: id, branch_id: branch_id}),
    do: "#{id}:#{branch_id}"

  defp current_item_query(attrs) do
    query =
      from(item in Item,
        where:
          item.owner == ^attrs.owner and item.target_type == ^attrs.target_type and
            item.target_id == ^attrs.target_id and item.subject_ref == ^attrs.subject_ref and
            item.status == :open,
        lock: "FOR UPDATE"
      )

    if is_nil(attrs.community_id) do
      where(query, [item], is_nil(item.community_id))
    else
      where(query, [item], item.community_id == ^attrs.community_id)
    end
  end

  defp update_ai_opinion(item, %{ai_source_ref: nil}), do: {:ok, item}

  defp update_ai_opinion(%Item{ai_source_ref: source} = item, %{ai_source_ref: source} = attrs) do
    if item.sus_notes == attrs.sus_notes and item.summary == attrs.summary do
      {:ok, item}
    else
      {:error, AlertWall.ErrorCat.operation_conflict()}
    end
  end

  defp update_ai_opinion(%Item{} = item, attrs) do
    item
    |> Item.changeset(%{
      ai_source_ref: attrs.ai_source_ref,
      sus_notes: attrs.sus_notes,
      summary: attrs.summary,
      version: item.version + 1
    })
    |> Repo.update()
  end

  defp validate_item(attrs) do
    required = [:owner, :target_type, :target_id, :subject_ref]
    notes = Map.get(attrs, :sus_notes, [])
    summary = Map.get(attrs, :summary, "")
    source_ref = Map.get(attrs, :ai_source_ref)

    cond do
      Enum.any?(required, &(not Map.has_key?(attrs, &1))) ->
        {:error, AlertWall.ErrorCat.invalid_item()}

      attrs.owner not in [:cms, :accounts] or
          attrs.target_type not in [:article, :comment, :doc, :user] ->
        {:error, AlertWall.ErrorCat.invalid_item()}

      (attrs.owner == :cms and attrs.target_type == :user) or
        (attrs.owner == :accounts and attrs.target_type != :user) or
          (attrs.target_type == :doc and not is_nil(Map.get(attrs, :community_id))) ->
        {:error, AlertWall.ErrorCat.invalid_item()}

      not is_binary(attrs.target_id) or attrs.target_id == "" or not is_binary(attrs.subject_ref) or
          attrs.subject_ref == "" ->
        {:error, AlertWall.ErrorCat.invalid_item()}

      not is_list(notes) or not is_binary(summary) or
          (not is_nil(source_ref) and not match?({:ok, _}, Ecto.UUID.cast(source_ref))) ->
        {:error, AlertWall.ErrorCat.invalid_item()}

      is_nil(source_ref) and notes != [] ->
        {:error, AlertWall.ErrorCat.invalid_item()}

      true ->
        {:ok,
         Map.merge(%{community_id: nil, ai_source_ref: nil, sus_notes: [], summary: ""}, attrs)}
    end
  end

  defp prior_action(action, operation_ref, digest) do
    case Repo.get_by(Action, action: action, operation_ref: operation_ref) do
      %Action{request_digest: ^digest, result: %{"item_id" => item_id}} ->
        case Repo.get(Item, item_id) do
          %Item{} = item -> {:ok, item}
          nil -> {:error, AlertWall.ErrorCat.item_not_found()}
        end

      %Action{} ->
        {:error, AlertWall.ErrorCat.operation_conflict()}

      nil ->
        {:ok, :new}
    end
  end

  defp record_action(item, action, source, actor, operation_ref, digest, result) do
    Repo.insert(
      Action.changeset(%Action{}, %{
        item_id: item.id,
        action: action,
        source: source,
        actor_id: actor && actor.id,
        operation_ref: operation_ref,
        request_digest: digest,
        result: result
      })
    )
  end

  defp validate_report(attrs, operation_ref) do
    required = [:reporter_id, :owner, :target_type, :target_id, :subject_ref, :report_type]

    cond do
      Enum.any?(required, &(not Map.has_key?(attrs, &1))) ->
        {:error, AlertWall.ErrorCat.invalid_report()}

      attrs.owner not in [:cms, :accounts] or
        attrs.target_type not in [:article, :comment, :doc, :user] or
          attrs.report_type not in @report_types ->
        {:error, AlertWall.ErrorCat.invalid_report()}

      (attrs.owner == :cms and attrs.target_type == :user) or
        (attrs.owner == :accounts and attrs.target_type != :user) or
          (attrs.target_type == :doc and not is_nil(Map.get(attrs, :community_id))) ->
        {:error, AlertWall.ErrorCat.invalid_report()}

      not is_integer(attrs.reporter_id) or not is_binary(attrs.target_id) or
        attrs.target_id == "" or not is_binary(attrs.subject_ref) or attrs.subject_ref == "" or
          (not is_nil(Map.get(attrs, :details)) and not is_binary(attrs.details)) ->
        {:error, AlertWall.ErrorCat.invalid_report()}

      true ->
        {:ok,
         attrs
         |> Map.put(:operation_ref, operation_ref)
         |> Map.put_new(:community_id, nil)
         |> Map.put_new(:details, "")}
    end
  end

  defp prior_report(%{operation_ref: operation_ref} = attrs) do
    case Repo.get_by(UserReport, operation_ref: operation_ref) do
      %UserReport{} = report ->
        if report_matches?(report, attrs) do
          {:ok, report}
        else
          {:error, AlertWall.ErrorCat.operation_conflict()}
        end

      nil ->
        {:ok, nil}
    end
  end

  defp submit_new_report(%UserReport{} = report, _attrs, _operation_ref), do: {:ok, report}

  defp submit_new_report(nil, attrs, operation_ref) do
    with {:ok, item} <-
           add_in_transaction(
             %{
               owner: attrs.owner,
               target_type: attrs.target_type,
               target_id: attrs.target_id,
               community_id: attrs.community_id,
               subject_ref: attrs.subject_ref,
               ai_source_ref: nil,
               sus_notes: [],
               summary: ""
             },
             operation_ref
           ),
         {:ok, report} <-
           Repo.insert(
             UserReport.changeset(%UserReport{}, %{
               item_id: item.id,
               reporter_id: attrs.reporter_id,
               owner: attrs.owner,
               target_type: attrs.target_type,
               target_id: attrs.target_id,
               community_id: attrs.community_id,
               subject_ref: attrs.subject_ref,
               report_type: attrs.report_type,
               details: attrs.details,
               operation_ref: operation_ref
             }),
             mode: :savepoint
           ) do
      {:ok, report}
    end
  end

  defp report_matches?(report, attrs) do
    report.reporter_id == attrs.reporter_id and report.owner == attrs.owner and
      report.target_type == attrs.target_type and report.target_id == attrs.target_id and
      report.community_id == attrs.community_id and report.subject_ref == attrs.subject_ref and
      report.report_type == attrs.report_type and report.details == attrs.details
  end

  defp lock_report(report_id) do
    Repo.one(from(report in UserReport, where: report.id == ^report_id, lock: "FOR UPDATE"))
  end

  defp withdraw_report(%UserReport{withdrawn_at: withdrawn_at} = report)
       when not is_nil(withdrawn_at) do
    {:ok, report}
  end

  defp withdraw_report(%UserReport{} = report) do
    report
    |> UserReport.changeset(%{withdrawn_at: DateTime.utc_now(:second)})
    |> Repo.update()
  end

  defp report_item_ids(report_id) do
    case Repo.get(UserReport, report_id) do
      %UserReport{item_id: item_id} -> [item_id]
      nil -> []
    end
  end

  defp supersede_items(items, operation_ref) do
    Enum.reduce_while(items, {:ok, :pass}, fn item, {:ok, :pass} ->
      item_operation_ref = item_operation_ref(operation_ref, item.id)

      case transition(item.id, :supersede, "superseded", item_operation_ref, nil, :cms) do
        {:ok, _item} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp supersede_deleted_targets(items, operation_ref, source \\ :cms) do
    Enum.reduce_while(items, {:ok, :pass}, fn item, {:ok, :pass} ->
      item_operation_ref = item_operation_ref(operation_ref, item.id)

      request_digest =
        digest(%{item_id: item.id, action: :supersede, reason: :target_deleted})

      with {:ok, :new} <- prior_action(:supersede, item_operation_ref, request_digest),
           {:ok, updated} <-
             item
             |> Item.changeset(%{
               status: :superseded,
               target_deleted_at: DateTime.utc_now(:second),
               version: item.version + 1
             })
             |> Repo.update(),
           {:ok, :pass} <- update_report_status(updated, :supersede, "target_deleted"),
           {:ok, _action} <-
             record_action(
               updated,
               :supersede,
               source,
               nil,
               item_operation_ref,
               request_digest,
               item_result(updated)
             ) do
        {:cont, {:ok, :pass}}
      else
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp resolve_items(items, resolution, operation_ref) do
    Enum.reduce_while(items, {:ok, :pass}, fn item, {:ok, :pass} ->
      item_operation_ref = item_operation_ref(operation_ref, item.id)

      case transition(item.id, :resolve, resolution, item_operation_ref, nil, :cms) do
        {:ok, _item} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp item_operation_ref(operation_ref, item_id) do
    digest = :crypto.hash(:sha256, "#{operation_ref}:#{item_id}")
    <<uuid::binary-size(16), _rest::binary>> = digest
    Ecto.UUID.load!(uuid)
  end

  defp lock_item(item_id) do
    Repo.one(from(item in Item, where: item.id == ^item_id, lock: "FOR UPDATE"))
  end

  defp lock(query), do: Ecto.Query.lock(query, "FOR UPDATE")

  defp require_transaction do
    if Repo.in_transaction?() do
      {:ok, :pass}
    else
      {:error, AlertWall.ErrorCat.requires_transaction()}
    end
  end

  defp item_result(%Item{id: item_id}), do: %{"item_id" => item_id}

  defp digest(value) do
    value
    |> canonical()
    |> Jason.encode!()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end

  defp canonical(%_{} = value), do: value |> Map.from_struct() |> canonical()

  defp canonical(value) when is_map(value) do
    Map.new(value, fn {key, item} -> {to_string(key), canonical(item)} end)
  end

  defp canonical(value) when is_list(value), do: Enum.map(value, &canonical/1)
  defp canonical(value) when is_atom(value), do: Atom.to_string(value)
  defp canonical(value), do: value
end
