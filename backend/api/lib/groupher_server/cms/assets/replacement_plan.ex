defmodule GroupherServer.CMS.Assets.ReplacementPlan do
  @moduledoc """
  Builds and applies immutable global asset replacement plans.

  Plan creation is read-only with respect to Articles. Apply revalidates each
  observed locator/version through `Commands.ReplaceUse`; conflicts are recorded per
  item and never turn into a false global success.

  Business position:

      editor or community manager
        -> ReplacementPlan create/apply
        -> per-item revalidation -> Article Draft replacement command
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Assets.Commands.ReplaceUse
  alias CMS.Assets.Query

  alias CMS.Model.{
    Article,
    ArticleDraft,
    ArticlePublic,
    AssetReplacementPlan,
    Community,
    CommunityAsset
  }

  @doc "Creates a reviewable plan from current usage facts."
  def create(%Community{id: community_id} = community, attrs, %User{id: user_id} = user)
      when is_map(attrs) do
    with {:ok, from_asset} <- active_asset(community_id, value(attrs, :from_asset_id)),
         {:ok, to_asset} <- active_asset(community_id, value(attrs, :to_asset_id)),
         false <- from_asset.id == to_asset.id,
         {:ok, usages} <- Query.usages(%Community{id: community_id}, from_asset.id, user) do
      items = build_items(usages, community, user, from_asset, to_asset)

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

  @doc "Applies selected plan items as independent Article Draft commands."
  def apply(%AssetReplacementPlan{} = plan, %User{} = user, opts \\ []) do
    plan = Repo.get!(AssetReplacementPlan, plan.id)
    selected = Keyword.get(opts, :article_ids)
    body_bags = Keyword.get(opts, :body_bags, %{})
    apply_run_ref = plan.apply_run_ref || apply_run_ref(plan)

    with {:ok, plan} <- persist_apply_run_ref(plan, apply_run_ref) do
      {items, applied_count, conflict_count} =
        Enum.map_reduce(plan.items, {0, 0}, fn item, {applied_count, conflict_count} ->
          article_id = item_value(item, :article_id)

          if selected && article_id not in selected do
            {item, {applied_count, conflict_count}}
          else
            case apply_item(plan, item, user, body_bags, apply_run_ref) do
              {:ok, updated_item, result} ->
                {put_item_result(updated_item, :applied, result),
                 {applied_count + 1, conflict_count}}

              {:error, reason} ->
                {put_item_result(item, :conflict, %{reason: inspect(reason)}),
                 {applied_count, conflict_count + 1}}
            end
          end
        end)
        |> then(fn {items, {applied_count, conflict_count}} ->
          {items, applied_count, conflict_count}
        end)

      status =
        cond do
          conflict_count > 0 -> :partially_applied
          applied_count > 0 and all_selected_applied?(items, selected) -> :completed
          true -> :pending
        end

      plan
      |> AssetReplacementPlan.changeset(%{
        items: items,
        status: status,
        apply_run_ref: apply_run_ref,
        applied_at: if(applied_count > 0, do: DateTime.utc_now(:second), else: plan.applied_at)
      })
      |> Repo.update()
    end
  end

  defp apply_item(plan, item, user, body_bags, apply_run_ref) do
    article_id = item_value(item, :article_id)
    body_bag = Map.get(body_bags, article_id) || Map.get(body_bags, to_string(article_id))

    with {:ok, _} <- live_revision_matches?(item, article_id),
         {:ok, updated_item, result} <-
           apply_locators(plan, item, article_id, body_bag, user, apply_run_ref) do
      {:ok, updated_item, result}
    end
  end

  defp apply_locators(plan, item, article_id, body_bag, user, apply_run_ref) do
    draft_version =
      item_value(item, :current_draft_version) || item_value(item, :observed_draft_version)

    community = Repo.get!(Community, plan.community_id)

    (item_value(item, :usage_locators) || [])
    |> Enum.reduce_while({:ok, item, nil, draft_version}, fn locator,
                                                             {:ok, current_item, _last, version} ->
      step_ref = item_value(locator, :step_ref) || replacement_step_ref(locator)

      case apply_locator_step(
             plan,
             current_item,
             locator,
             article_id,
             body_bag,
             version,
             community,
             user,
             apply_run_ref,
             step_ref
           ) do
        {:ok, updated_item, result, next_version} ->
          {:cont, {:ok, updated_item, result, next_version}}

        {:error, reason} ->
          _ = mark_locator_failed(plan.id, article_id, step_ref, reason)
          {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, updated_item, result, _version} -> {:ok, updated_item, result}
      {:error, _reason} = error -> error
    end
  end

  defp apply_locator_step(
         plan,
         item,
         locator,
         article_id,
         body_bag,
         version,
         community,
         user,
         apply_run_ref,
         step_ref
       ) do
    Repo.transaction(fn ->
      locked_plan = lock_plan(plan.id)
      persisted_item = plan_item(locked_plan.items, article_id) || item
      persisted_locator = plan_locator(persisted_item, step_ref) || locator

      case item_value(persisted_locator, :status) do
        status when status in [:succeeded, "succeeded"] ->
          result = item_value(persisted_locator, :result)
          next_version = item_value(persisted_item, :current_draft_version) || version
          {:ok, persisted_item, result, next_version}

        _ ->
          workflow_ref = "asset-replacement:#{plan.id}:#{article_id}:#{step_ref}"

          attrs =
            %{
              expected_draft_version: version,
              usage: item_value(persisted_locator, :usage),
              block_id: item_value(persisted_locator, :block_id),
              position: item_value(persisted_locator, :position),
              from_asset_id: plan.from_asset_id,
              to_asset_id: plan.to_asset_id,
              step_ref: step_ref
            }
            |> maybe_put_body_bag(body_bag)

          with {:ok, result} <-
                 ReplaceUse.execute(
                   %{article_id: article_id, community: community},
                   attrs,
                   user,
                   {:workflow, workflow_ref}
                 ),
               next_version <- Map.get(result, :draft_version, version),
               updated_item <-
                 persist_locator_success(
                   locked_plan,
                   persisted_item,
                   persisted_locator,
                   step_ref,
                   result,
                   next_version,
                   apply_run_ref
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
      |> put_value(:current_draft_version, next_version)
      |> put_value(:apply_run_ref, apply_run_ref)
      |> replace_locator(step_ref, updated_locator)

    items = replace_plan_item(plan.items, item_value(updated_item, :article_id), updated_item)

    case plan
         |> AssetReplacementPlan.changeset(%{items: items, apply_run_ref: apply_run_ref})
         |> Repo.update() do
      {:ok, _plan} -> updated_item
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp mark_locator_failed(plan_id, article_id, step_ref, reason) do
    Repo.transaction(fn ->
      plan = lock_plan(plan_id)

      case plan_item(plan.items, article_id) do
        nil ->
          :pass

        item ->
          locator = plan_locator(item, step_ref)

          if locator do
            updated_locator =
              locator
              |> put_value(:status, "failed")
              |> put_value(:result, %{"reason" => inspect(reason)})

            updated_item = replace_locator(item, step_ref, updated_locator)
            items = replace_plan_item(plan.items, article_id, updated_item)

            case plan |> AssetReplacementPlan.changeset(%{items: items}) |> Repo.update() do
              {:ok, _} -> :pass
              {:error, update_reason} -> Repo.rollback(update_reason)
            end
          else
            :pass
          end
      end
    end)
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

  defp plan_item(items, article_id),
    do: Enum.find(items, &(item_value(&1, :article_id) == article_id))

  defp plan_locator(item, step_ref),
    do:
      Enum.find(item_value(item, :usage_locators) || [], &(item_value(&1, :step_ref) == step_ref))

  defp replace_plan_item(items, article_id, updated_item),
    do:
      Enum.map(items, fn item ->
        if item_value(item, :article_id) == article_id, do: updated_item, else: item
      end)

  defp replace_locator(item, step_ref, updated_locator) do
    locators =
      (item_value(item, :usage_locators) || [])
      |> Enum.map(fn locator ->
        if item_value(locator, :step_ref) == step_ref, do: updated_locator, else: locator
      end)

    put_value(item, :usage_locators, locators)
  end

  defp apply_run_ref(%AssetReplacementPlan{id: plan_id}), do: "asset-replacement-apply:#{plan_id}"

  defp all_selected_applied?(items, nil),
    do: items != [] and Enum.all?(items, &item_applied?/1)

  defp all_selected_applied?(items, selected) do
    selected = MapSet.new(selected)

    items
    |> Enum.filter(&MapSet.member?(selected, item_value(&1, :article_id)))
    |> case do
      [] -> false
      selected_items -> Enum.all?(selected_items, &item_applied?/1)
    end
  end

  defp item_applied?(item) do
    case item_value(item, :result) do
      result when is_map(result) -> item_value(result, :status) in [:applied, "applied"]
      _ -> false
    end
  end

  defp put_value(map, key, value) do
    cond do
      Map.has_key?(map, key) -> Map.put(map, key, value)
      Map.has_key?(map, Atom.to_string(key)) -> Map.put(map, Atom.to_string(key), value)
      true -> Map.put(map, key, value)
    end
  end

  defp json_safe(value) when is_map(value),
    do: Map.new(value, fn {key, value} -> {to_string(key), json_safe(value)} end)

  defp json_safe(value) when is_list(value), do: Enum.map(value, &json_safe/1)
  defp json_safe(value) when is_atom(value), do: Atom.to_string(value)
  defp json_safe(value), do: value

  defp build_items(usages, community, user, from_asset, to_asset) do
    usages
    |> Enum.group_by(& &1.article_id)
    |> Enum.map(fn {article_id, refs} ->
      draft = Repo.get_by(ArticleDraft, article_id: article_id)
      public = Repo.get_by(ArticlePublic, article_id: article_id)
      lifecycle = Enum.map(refs, & &1.lifecycle)
      decision = decision(Repo.get(Article, article_id), draft, lifecycle, community, user)

      %{
        article_id: article_id,
        observed_live_revision_id: public && public.revision_id,
        observed_draft_version: draft && draft.version,
        usage_locators: Enum.map(refs, &locator/1),
        from_asset_ref: from_asset.public_ref,
        to_asset_ref: to_asset.public_ref,
        decision: decision,
        result: nil
      }
    end)
  end

  defp decision(article, nil, lifecycle, community, user) do
    if lifecycle != [] and Enum.all?(lifecycle, &(&1 in [:historical, :trashed])) do
      "historical_only"
    else
      decision(article, %ArticleDraft{}, lifecycle, community, user)
    end
  end

  defp decision(article, _draft, _lifecycle, community, user) do
    case CMS.Gate.with_community_check(user, :edit, community, article, fn _ ->
           {:ok, :pass}
         end) do
      {:ok, _} -> "editable"
      _ -> "permission_denied"
    end
  end

  defp locator(ref) do
    locator = Map.take(ref, [:usage, :block_id, :position, :block_type, :title, :alt, :source])

    locator
    |> Map.put(:step_ref, replacement_step_ref(locator))
  end

  defp replacement_step_ref(locator) do
    locator
    |> :erlang.term_to_binary()
    |> Base.url_encode64(padding: false)
  end

  defp live_revision_matches?(item, article_id) do
    observed = item_value(item, :observed_live_revision_id)

    current =
      case Repo.get_by(ArticlePublic, article_id: article_id) do
        %ArticlePublic{revision_id: revision_id} -> revision_id
        nil -> nil
      end

    if observed == current, do: {:ok, :pass}, else: {:error, :live_revision_conflict}
  end

  defp put_item_result(item, status, result) do
    Map.merge(item, %{result: %{status: status, value: result}})
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
