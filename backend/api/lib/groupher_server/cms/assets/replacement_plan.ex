defmodule GroupherServer.CMS.Assets.ReplacementPlan do
  @moduledoc """
  Builds and applies immutable global asset replacement plans.

  Plan creation is read-only with respect to Articles. Apply revalidates each
  observed locator/revision through `Commands.ReplaceUse`; conflicts are recorded per
  item and never turn into a false global success.

  Business position:

      editor or community manager
        -> ReplacementPlan create/apply
        -> per-item revalidation -> Article WorkingCopy replacement command
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Assets.{Commands.ReplaceUse, Workflow, Query}
  alias CMS.Articles.Lifecycle, as: ArticleLifecycle
  alias CMS.Communities.Lifecycle, as: CommunityLifecycle

  alias CMS.Model.{
    ArticlePublic,
    AssetReplacementPlan,
    AssetWorkflowRun,
    Community,
    CommunityAsset
  }

  defmodule PlanContext do
    @moduledoc """
    Carries the plan-level state shared while applying replacement items.

        ReplacementPlan.apply
          -> PlanContext
          -> per-article replacement steps
    """
    @enforce_keys [:plan, :community, :actor, :apply_run_ref, :owner]
    defstruct @enforce_keys
  end

  defmodule ArticleContext do
    @moduledoc """
    Carries the article snapshot used to validate one replacement item.

        replacement plan item
          -> ArticleContext
          -> ReplaceUse command
    """
    @enforce_keys [:item, :article_id, :body_bag, :revision]
    defstruct @enforce_keys
  end

  defmodule StepContext do
    @moduledoc """
    Carries the claimed workflow step used to apply one replacement locator.

        workflow claim
          -> StepContext
          -> replacement step completion
    """
    @enforce_keys [:locator, :step_ref, :claimed_step, :operation_ref]
    defstruct @enforce_keys
  end

  @doc "Creates a reviewable plan from current usage facts."
  def create(%Community{id: community_id}, attrs, %User{id: user_id} = user)
      when is_map(attrs) do
    with {:ok, from_asset} <- active_asset(community_id, value(attrs, :from_asset_id)),
         {:ok, to_asset} <- active_asset(community_id, value(attrs, :to_asset_id)),
         false <- from_asset.id == to_asset.id,
         {:ok, usages} <-
           Query.replacement_usages(%Community{id: community_id}, from_asset.id, user) do
      items = build_items(usages, from_asset, to_asset)

      %AssetReplacementPlan{}
      |> AssetReplacementPlan.changeset(%{
        community_id: community_id,
        from_asset_id: from_asset.id,
        to_asset_id: to_asset.id,
        created_by_id: user_id,
        status: :pending,
        items: items
      })
      |> Repo.insert()
    else
      true -> {:error, :replacement_assets_must_differ}
      {:error, _reason} = error -> error
    end
  end

  @doc "Applies selected plan items as independent Article WorkingCopy commands."
  def apply(%AssetReplacementPlan{} = plan, %User{} = user, opts \\ []) do
    plan = Repo.get!(AssetReplacementPlan, plan.id)
    selected = Keyword.get(opts, :article_ids)
    body_bags = Keyword.get(opts, :body_bags, %{})
    apply_run_ref = plan.apply_run_ref || apply_run_ref(plan)

    with {:ok, plan} <- persist_apply_run_ref(plan, apply_run_ref),
         {:ok, run} <- ensure_apply_run(plan, apply_run_ref),
         owner <- "asset-replacement:#{apply_run_ref}:#{Ecto.UUID.generate()}",
         run_claim <- Workflow.claim_run(run, owner) do
      handle_apply_claim(run_claim, plan, user, body_bags, selected, apply_run_ref, owner)
    else
      {:error, _reason} = error -> error
    end
  end

  defp handle_apply_claim({:completed, _run}, plan, _user, _bags, _selected, _ref, _owner) do
    {:ok, plan}
  end

  defp handle_apply_claim({:busy, seconds}, _plan, _user, _bags, _selected, _ref, _owner) do
    {:error, {:workflow_busy, seconds}}
  end

  defp handle_apply_claim({:ok, run_state}, plan, user, body_bags, selected, apply_run_ref, owner) do
    with {:ok, steps} <- ensure_apply_steps(run_state, plan),
         {items, applied_count, skipped_count, conflict_count} <-
           apply_items(plan, user, body_bags, selected, apply_run_ref, steps, owner),
         {:ok, _finished} <- Workflow.finish_run(run_state, owner) do
      update_applied_plan(plan, items, selected, apply_run_ref, {
        applied_count,
        skipped_count,
        conflict_count
      })
    end
  end

  defp update_applied_plan(plan, items, selected, apply_run_ref, counts) do
    {applied_count, _skipped_count, _conflict_count} = counts

    plan
    |> AssetReplacementPlan.changeset(%{
      items: items,
      status: apply_status(items, selected, counts),
      apply_run_ref: apply_run_ref,
      applied_at: if(applied_count > 0, do: DateTime.utc_now(:second), else: plan.applied_at)
    })
    |> Repo.update()
  end

  defp apply_status(_items, _selected, {_applied, _skipped, conflict}) when conflict > 0 do
    :partially_applied
  end

  defp apply_status(items, selected, {applied, skipped, _conflict}) do
    if applied + skipped > 0 and all_selected_finished?(items, selected) do
      :completed
    else
      :pending
    end
  end

  defp apply_items(plan, user, body_bags, selected, apply_run_ref, steps, owner) do
    Enum.map_reduce(plan.items, {0, 0, 0}, fn item,
                                              {applied_count, skipped_count, conflict_count} ->
      article_id = item_value(item, :article_id)
      non_actionable = non_actionable_decision?(item_value(item, :decision))

      if selected && article_id not in selected && not non_actionable do
        {item, {applied_count, skipped_count, conflict_count}}
      else
        case apply_item(plan, item, user, body_bags, apply_run_ref, steps, owner) do
          {:ok, updated_item, result} ->
            {put_item_result(updated_item, :applied, result),
             {applied_count + 1, skipped_count, conflict_count}}

          {:skipped, updated_item, _result} ->
            {updated_item, {applied_count, skipped_count + 1, conflict_count}}

          {:error, reason} ->
            {put_item_result(item, :conflict, %{reason: inspect(reason)}),
             {applied_count, skipped_count, conflict_count + 1}}
        end
      end
    end)
    |> then(fn {items, {applied_count, skipped_count, conflict_count}} ->
      {items, applied_count, skipped_count, conflict_count}
    end)
  end

  defp non_actionable_decision?(decision) do
    decision in [
      :historical_only,
      "historical_only",
      :live_snapshot_only,
      "live_snapshot_only",
      :permission_denied,
      "permission_denied",
      :unsupported,
      "unsupported"
    ]
  end

  defp ensure_apply_run(%AssetReplacementPlan{} = plan, run_ref) do
    Workflow.ensure_run(%{
      workflow_ref: run_ref,
      workflow_type: "asset_replacement_apply",
      community_id: plan.community_id,
      resource_type: "asset_replacement_plan",
      resource_id: to_string(plan.id),
      status: :pending
    })
  end

  defp ensure_apply_steps(%AssetWorkflowRun{} = run, %AssetReplacementPlan{} = plan) do
    plan.items
    |> Enum.flat_map(fn item ->
      article_id = item_value(item, :article_id)

      Enum.map(item_value(item, :usage_locators) || [], fn locator ->
        step_ref = item_value(locator, :step_ref) || replacement_step_ref(locator)
        {article_id, step_ref, locator}
      end)
    end)
    |> Enum.reduce_while({:ok, []}, fn {article_id, step_ref, locator}, {:ok, steps} ->
      step_ref = step_key(article_id, step_ref)

      case Workflow.ensure_step(run, %{
             step_ref: step_ref,
             resource_type: "article_asset_ref",
             resource_id: to_string(article_id),
             status: :pending,
             payload: %{article_id: article_id, locator: json_safe(locator)},
             result: %{},
             attempts: 0
           }) do
        {:ok, step} -> {:cont, {:ok, [step | steps]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, steps} -> {:ok, Enum.reverse(steps)}
      error -> error
    end
  end

  defp apply_item(plan, item, user, body_bags, apply_run_ref, steps, owner) do
    article_id = item_value(item, :article_id)
    body_bag = Map.get(body_bags, item_value(item, :working_copy_id))

    case item_value(item, :decision) do
      decision
      when decision in [
             :historical_only,
             "historical_only",
             :live_snapshot_only,
             "live_snapshot_only",
             :permission_denied,
             "permission_denied",
             :unsupported,
             "unsupported"
           ] ->
        with {:ok, :pass} <- skip_item_steps(item, article_id, steps, owner) do
          result = %{reason: to_string(decision)}
          {:skipped, put_item_result(item, :skipped, result), result}
        end

      _decision ->
        with working_copy_id when is_binary(working_copy_id) <- item_value(item, :working_copy_id),
             {:ok, _} <- live_snapshot_matches?(item, article_id) do
          apply_locators(plan, item, article_id, body_bag, user, apply_run_ref, steps, owner)
        else
          {:error, _reason} = error -> error
          _ -> {:error, :working_copy_required}
        end
    end
  end

  defp skip_item_steps(item, article_id, steps, owner) do
    Enum.reduce_while(item_value(item, :usage_locators) || [], {:ok, :pass}, fn locator,
                                                                                {:ok, :pass} ->
      step_ref = item_value(locator, :step_ref) || replacement_step_ref(locator)
      workflow_step = Enum.find(steps, &(step_key(article_id, step_ref) == &1.step_ref))

      case Workflow.claim_step(workflow_step, owner) do
        {:completed, _step} ->
          {:cont, {:ok, :pass}}

        {:busy, seconds} ->
          {:halt, {:error, {:workflow_step_busy, seconds}}}

        {:ok, claimed_step} ->
          case Workflow.skip_step(claimed_step, owner, %{"reason" => "plan_decision"}) do
            {:ok, :pass} -> {:cont, {:ok, :pass}}
            {:error, reason} -> {:halt, {:error, reason}}
          end

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp apply_locators(plan, item, article_id, body_bag, user, apply_run_ref, steps, owner) do
    revision =
      item_value(item, :current_working_copy_revision) ||
        item_value(item, :observed_working_copy_revision)

    community = Repo.get!(Community, plan.community_id)

    plan_context = %PlanContext{
      plan: plan,
      community: community,
      actor: user,
      apply_run_ref: apply_run_ref,
      owner: owner
    }

    (item_value(item, :usage_locators) || [])
    |> Enum.reduce_while({:ok, item, nil, revision}, fn locator,
                                                        {:ok, current_item, _last, revision} ->
      step_ref = item_value(locator, :step_ref) || replacement_step_ref(locator)
      workflow_step = Enum.find(steps, &(step_key(article_id, step_ref) == &1.step_ref))

      case Workflow.claim_step(workflow_step, owner) do
        {:completed, _step} ->
          apply_claimed_locator(
            plan_context,
            %ArticleContext{
              item: current_item,
              article_id: article_id,
              body_bag: body_bag,
              revision: revision
            },
            %StepContext{
              locator: locator,
              step_ref: step_ref,
              claimed_step: nil,
              operation_ref: workflow_step.operation_ref
            }
          )

        {:busy, seconds} ->
          {:halt, {:error, {:workflow_step_busy, seconds}}}

        {:ok, claimed_step} ->
          apply_claimed_locator(
            plan_context,
            %ArticleContext{
              item: current_item,
              article_id: article_id,
              body_bag: body_bag,
              revision: revision
            },
            %StepContext{
              locator: locator,
              step_ref: step_ref,
              claimed_step: claimed_step,
              operation_ref: claimed_step.operation_ref
            }
          )
      end
    end)
    |> case do
      {:ok, updated_item, result, _version} -> {:ok, updated_item, result}
      {:error, _reason} = error -> error
    end
  end

  defp apply_claimed_locator(
         %PlanContext{} = plan_context,
         %ArticleContext{} = article_context,
         %StepContext{} = step_context
       ) do
    case apply_locator_step(plan_context, article_context, step_context) do
      {:ok, updated_item, result, next_version} ->
        if step_context.claimed_step do
          Workflow.complete_step(
            step_context.claimed_step,
            plan_context.owner,
            json_safe(result)
          )
        end

        {:cont, {:ok, updated_item, result, next_version}}

      {:error, reason} ->
        if step_context.claimed_step do
          _ =
            Workflow.fail_step(
              step_context.claimed_step,
              plan_context.owner,
              reason,
              conflict_status(reason)
            )
        end

        _ =
          mark_locator_failed(
            plan_context.plan.id,
            item_key(article_context.item),
            step_context.step_ref,
            reason
          )

        {:halt, {:error, reason}}
    end
  end

  defp apply_locator_step(
         %PlanContext{} = plan_context,
         %ArticleContext{} = article_context,
         %StepContext{} = step_context
       ) do
    Repo.transaction(fn ->
      locked_plan = lock_plan(plan_context.plan.id)

      persisted_item =
        plan_item(locked_plan.items, item_key(article_context.item)) || article_context.item

      persisted_locator =
        plan_locator(persisted_item, step_context.step_ref) || step_context.locator

      case item_value(persisted_locator, :status) do
        status when status in [:succeeded, "succeeded"] ->
          result = item_value(persisted_locator, :result)

          next_version =
            item_value(persisted_item, :current_working_copy_revision) || article_context.revision

          {:ok, persisted_item, result, next_version}

        _ ->
          workflow_ref =
            "asset-replacement:#{plan_context.plan.id}:#{article_context.article_id}:#{step_context.step_ref}"

          attrs =
            %{
              revision: article_context.revision,
              working_copy_id: item_value(persisted_item, :working_copy_id),
              usage: item_value(persisted_locator, :usage),
              block_id: item_value(persisted_locator, :block_id),
              position: item_value(persisted_locator, :position),
              from_asset_id: plan_context.plan.from_asset_id,
              to_asset_id: plan_context.plan.to_asset_id,
              step_ref: step_context.step_ref
            }
            |> maybe_put_body_bag(article_context.body_bag)

          with {:ok, result} <-
                 ReplaceUse.execute_for_workflow(
                   %{
                     article_id: article_context.article_id,
                     community: plan_context.community
                   },
                   attrs,
                   plan_context.actor,
                   workflow_ref,
                   step_context.operation_ref
                 ),
               next_version <- Map.get(result, :revision, article_context.revision),
               updated_item <-
                 persist_locator_success(
                   locked_plan,
                   persisted_item,
                   persisted_locator,
                   step_context.step_ref,
                   result,
                   next_version,
                   plan_context.apply_run_ref
                 ) do
            {:ok, updated_item, result, next_version}
          else
            {:error, reason} -> Repo.rollback(reason)
          end
      end
    end)
    |> case do
      {:ok, {:ok, updated_item, result, next_version}} ->
        {:ok, updated_item, result, next_version}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp persist_locator_success(
         plan,
         item,
         locator,
         step_ref,
         result,
         next_version,
         apply_run_ref
       ) do
    updated_locator =
      locator
      |> put_value(:status, "succeeded")
      |> put_value(:result, json_safe(result))

    updated_item =
      item
      |> put_value(:current_working_copy_revision, next_version)
      |> put_value(:apply_run_ref, apply_run_ref)
      |> replace_locator(step_ref, updated_locator)

    items = replace_plan_item(plan.items, updated_item)

    case plan
         |> AssetReplacementPlan.changeset(%{items: items, apply_run_ref: apply_run_ref})
         |> Repo.update() do
      {:ok, _plan} -> updated_item
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp mark_locator_failed(plan_id, article_id, step_ref, reason) do
    Repo.transaction(fn ->
      plan_id
      |> lock_plan()
      |> mark_locator_failed_locked(article_id, step_ref, reason)
    end)
  end

  defp mark_locator_failed_locked(plan, article_id, step_ref, reason) do
    case plan_item(plan.items, article_id) do
      nil -> :pass
      item -> persist_failed_locator(plan, item, article_id, step_ref, reason)
    end
  end

  defp persist_failed_locator(plan, item, _article_id, step_ref, reason) do
    case plan_locator(item, step_ref) do
      nil ->
        :pass

      locator ->
        updated_locator =
          locator
          |> put_value(:status, "failed")
          |> put_value(:result, %{"reason" => inspect(reason)})

        updated_item = replace_locator(item, step_ref, updated_locator)
        items = replace_plan_item(plan.items, updated_item)

        case plan |> AssetReplacementPlan.changeset(%{items: items}) |> Repo.update() do
          {:ok, _} -> :pass
          {:error, update_reason} -> Repo.rollback(update_reason)
        end
    end
  end

  defp persist_apply_run_ref(%{apply_run_ref: ref} = plan, ref), do: {:ok, plan}

  defp persist_apply_run_ref(plan, ref) do
    plan
    |> AssetReplacementPlan.changeset(%{apply_run_ref: ref})
    |> Repo.update()
  end

  defp lock_plan(plan_id) do
    from(plan in AssetReplacementPlan, where: plan.id == ^plan_id, lock: "FOR UPDATE")
    |> Repo.one!()
  end

  defp plan_item(items, key) do
    Enum.find(items, &(item_key(&1) == key))
  end

  defp plan_locator(item, step_ref) do
    Enum.find(item_value(item, :usage_locators) || [], &(item_value(&1, :step_ref) == step_ref))
  end

  defp replace_plan_item(items, updated_item) do
    Enum.map(items, fn item ->
      if item_key(item) == item_key(updated_item), do: updated_item, else: item
    end)
  end

  defp item_key(item), do: {item_value(item, :article_id), item_value(item, :working_copy_id)}

  defp replace_locator(item, step_ref, updated_locator) do
    locators =
      (item_value(item, :usage_locators) || [])
      |> Enum.map(fn locator ->
        if item_value(locator, :step_ref) == step_ref, do: updated_locator, else: locator
      end)

    put_value(item, :usage_locators, locators)
  end

  defp apply_run_ref(%AssetReplacementPlan{id: plan_id}), do: "asset-replacement-apply:#{plan_id}"

  defp step_key(article_id, step_ref), do: "article:#{article_id}:#{step_ref}"

  defp conflict_status(reason)
       when reason in [:live_snapshot_conflict, :revision_conflict] do
    :conflict
  end

  defp conflict_status(_reason), do: :failed

  defp all_selected_finished?(items, nil) do
    items != [] and Enum.all?(items, &item_finished?/1)
  end

  defp all_selected_finished?(items, selected) do
    selected = MapSet.new(selected)

    items
    |> Enum.filter(&MapSet.member?(selected, item_value(&1, :article_id)))
    |> case do
      [] -> false
      selected_items -> Enum.all?(selected_items, &item_finished?/1)
    end
  end

  defp item_finished?(item) do
    case item_value(item, :result) do
      result when is_map(result) ->
        item_value(result, :status) in [:applied, "applied", :skipped, "skipped"]

      _ ->
        false
    end
  end

  defp put_value(map, key, value) do
    cond do
      Map.has_key?(map, key) -> Map.put(map, key, value)
      Map.has_key?(map, Atom.to_string(key)) -> Map.put(map, Atom.to_string(key), value)
      true -> Map.put(map, key, value)
    end
  end

  defp json_safe(value) when is_map(value) do
    Map.new(value, fn {key, value} -> {to_string(key), json_safe(value)} end)
  end

  defp json_safe(value) when is_list(value), do: Enum.map(value, &json_safe/1)
  defp json_safe(value) when is_atom(value), do: Atom.to_string(value)
  defp json_safe(value), do: value

  defp build_items(usages, from_asset, to_asset) do
    usages
    |> Enum.group_by(&{&1.article_id, &1.observed_working_copy_id})
    |> Enum.map(fn {{article_id, working_copy_id}, refs} ->
      snapshot = hd(refs)

      %{
        article_id: article_id,
        working_copy_id: working_copy_id,
        observed_live_snapshot_id: snapshot.observed_live_snapshot_id,
        observed_working_copy_revision: snapshot.observed_working_copy_revision,
        usage_locators: Enum.map(refs, &locator/1),
        from_asset_ref: from_asset.public_ref,
        to_asset_ref: to_asset.public_ref,
        decision: decision(snapshot, refs),
        result: nil
      }
    end)
  end

  defp decision(%{thread: :doc}, _refs), do: "unsupported"

  defp decision(snapshot, refs) do
    cond do
      is_nil(snapshot.observed_working_copy_id) and Enum.any?(refs, &(&1.lifecycle == :live)) ->
        "live_snapshot_only"

      is_nil(snapshot.observed_working_copy_id) ->
        "historical_only"

      editable_snapshot?(snapshot) ->
        "editable"

      true ->
        "permission_denied"
    end
  end

  defp editable_snapshot?(snapshot) do
    with {:ok, true} <- ArticleLifecycle.editable?(snapshot.resource_lifecycle),
         {:ok, true} <- CommunityLifecycle.can_write(snapshot.community_lifecycle) do
      true
    else
      _ -> false
    end
  end

  defp locator(ref) do
    locator =
      Map.take(ref, [
        :usage,
        :block_id,
        :position,
        :block_type,
        :title,
        :alt,
        :source,
        :working_copy_id,
        :snapshot_id
      ])

    locator
    |> Map.put(:step_ref, replacement_step_ref(locator))
  end

  defp replacement_step_ref(locator) do
    locator
    |> :erlang.term_to_binary()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.url_encode64(padding: false)
  end

  defp live_snapshot_matches?(item, article_id) do
    observed = item_value(item, :observed_live_snapshot_id)

    current =
      case Repo.get_by(ArticlePublic, article_id: article_id) do
        %ArticlePublic{snapshot_id: snapshot_id} -> snapshot_id
        nil -> nil
      end

    if observed == current, do: {:ok, :pass}, else: {:error, :live_snapshot_conflict}
  end

  defp put_item_result(item, status, result) do
    put_value(item, :result, %{status: status, value: result})
  end

  defp maybe_put_body_bag(attrs, nil), do: attrs
  defp maybe_put_body_bag(attrs, body_bag), do: Map.put(attrs, :body_bag, body_bag)

  defp active_asset(community_id, asset_id) when is_binary(asset_id) or is_integer(asset_id) do
    case Repo.get_by(CommunityAsset, id: asset_id, community_id: community_id, status: :active) do
      %CommunityAsset{} = asset -> {:ok, asset}
      nil -> {:error, :replacement_asset_not_active}
    end
  end

  defp active_asset(_community_id, _asset_id), do: {:error, :replacement_asset_required}

  defp value(attrs, key), do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))
  defp item_value(item, key), do: Map.get(item, key) || Map.get(item, Atom.to_string(key))
end
