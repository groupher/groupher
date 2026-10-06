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
  def create(%Community{id: community_id}, attrs, %User{id: user_id} = user) when is_map(attrs) do
    with {:ok, from_asset} <- active_asset(community_id, value(attrs, :from_asset_id)),
         {:ok, to_asset} <- active_asset(community_id, value(attrs, :to_asset_id)),
         false <- from_asset.id == to_asset.id,
         {:ok, usages} <- Query.usages(%Community{id: community_id}, from_asset.id, user) do
      items = build_items(usages, user, from_asset, to_asset)

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
    selected = Keyword.get(opts, :article_ids)
    body_bags = Keyword.get(opts, :body_bags, %{})

    {items, applied_count, conflict_count} =
      Enum.map_reduce(plan.items, {0, 0}, fn item, {applied_count, conflict_count} ->
        article_id = item_value(item, :article_id)

        if selected && article_id not in selected do
          {item, {applied_count, conflict_count}}
        else
          case apply_item(plan, item, user, body_bags) do
            {:ok, result} ->
              {put_item_result(item, :applied, result), {applied_count + 1, conflict_count}}

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
        applied_count > 0 -> :completed
        true -> :pending
      end

    plan
    |> AssetReplacementPlan.changeset(%{
      items: items,
      status: status,
      applied_at: if(applied_count > 0, do: DateTime.utc_now(:second), else: plan.applied_at)
    })
    |> Repo.update()
  end

  defp apply_item(plan, item, user, body_bags) do
    article_id = item_value(item, :article_id)
    body_bag = Map.get(body_bags, article_id) || Map.get(body_bags, to_string(article_id))

    with :ok <- live_revision_matches?(item, article_id),
         {:ok, result} <- apply_locators(plan, item, article_id, body_bag, user) do
      {:ok, result}
    end
  end

  defp apply_locators(plan, item, article_id, body_bag, user) do
    draft_version = item_value(item, :observed_draft_version)

    (item_value(item, :usage_locators) || [])
    |> Enum.reduce_while({:ok, nil, draft_version}, fn locator, {:ok, _last, version} ->
      attrs =
        %{
          expected_draft_version: version,
          usage: item_value(locator, :usage),
          block_id: item_value(locator, :block_id),
          position: item_value(locator, :position),
          from_asset_id: plan.from_asset_id,
          to_asset_id: plan.to_asset_id,
          command_id: item_value(locator, :command_id)
        }
        |> maybe_put_body_bag(body_bag)

      case ReplaceUse.execute(%{article_id: article_id}, attrs, user, attrs.command_id) do
        {:ok, result} ->
          {:cont, {:ok, result, Map.get(result, :draft_version, version)}}

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, result, _version} -> {:ok, result}
      {:error, _reason} = error -> error
    end
  end

  defp build_items(usages, user, from_asset, to_asset) do
    usages
    |> Enum.group_by(& &1.article_id)
    |> Enum.map(fn {article_id, refs} ->
      draft = Repo.get_by(ArticleDraft, article_id: article_id)
      public = Repo.get_by(ArticlePublic, article_id: article_id)
      lifecycle = Enum.map(refs, & &1.lifecycle)
      decision = decision(Repo.get(Article, article_id), draft, lifecycle, user)

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

  defp decision(article, nil, lifecycle, user) do
    if lifecycle != [] and Enum.all?(lifecycle, &(&1 in [:historical, :trashed])) do
      "historical_only"
    else
      decision(article, %ArticleDraft{}, lifecycle, user)
    end
  end

  defp decision(article, _draft, _lifecycle, user) do
    case CMS.Gate.Access.with_check(user, :edit, article, fn _ -> :ok end) do
      :ok -> "editable"
      {:ok, :ok} -> "editable"
      _ -> "permission_denied"
    end
  end

  defp locator(ref) do
    ref
    |> Map.take([:usage, :block_id, :position, :block_type, :title, :alt, :source])
    |> Map.put(:command_id, Ecto.UUID.generate())
  end

  defp live_revision_matches?(item, article_id) do
    observed = item_value(item, :observed_live_revision_id)

    current =
      case Repo.get_by(ArticlePublic, article_id: article_id) do
        %ArticlePublic{revision_id: revision_id} -> revision_id
        nil -> nil
      end

    if observed == current, do: :ok, else: {:error, :live_revision_conflict}
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
