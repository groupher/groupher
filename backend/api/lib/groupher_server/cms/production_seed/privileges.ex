defmodule GroupherServer.CMS.ProductionSeed.Privileges do
  @moduledoc """
  Tracks seed-owned Global rows and confines temporary root to a transaction.

  The run owner serializes bootstrap and cleanup. Temporary elevation is never
  committed: it is restored before returning to the transaction owner.

      seed transaction -> owned Passport rows -> temporary root -> restore
  """
  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.Model.GlobalPassport
  alias Accounts.Model.User
  alias CMS.Articles.MutationLock
  alias Helper.ORM.AdvisoryLock

  @platform_permissions Map.new(
                          ~w(review.platform.read review.platform.decide review.platform.configure),
                          &{&1, true}
                        )

  def provision_platform!(users, manifest) do
    unless Repo.in_transaction?(), do: raise("seed privilege transaction required")
    lock_users!(Map.values(users))
    expected = manifest["globalPassports"] || %{}
    ensure_owned!(users, expected)
    user_id = Map.fetch!(users, "platform")

    row =
      case Repo.get_by(GlobalPassport, user_id: user_id) do
        nil ->
          %GlobalPassport{}
          |> GlobalPassport.changeset(%{user_id: user_id, permissions: @platform_permissions})
          |> Repo.insert!()

        row ->
          unless row.permissions == @platform_permissions and not row.is_root do
            Repo.rollback(:seed_unexpected_permissions)
          end

          row
      end

    %{"platform" => snapshot(row)}
  end

  def ensure_owned!(users, expected) do
    unless valid?(users, expected), do: Repo.rollback(:seed_unexpected_permissions)
    {:ok, :pass}
  end

  def valid?(users, expected) when is_map(users) and is_map(expected) do
    Enum.all?(users, fn {name, user_id} ->
      current = Repo.get_by(GlobalPassport, user_id: user_id)

      case {current, Map.get(expected, name)} do
        {nil, nil} -> true
        {%GlobalPassport{} = row, recorded} when is_map(recorded) -> snapshot(row) == recorded
        _ -> false
      end
    end) and Enum.all?(Map.keys(expected), &Map.has_key?(users, &1))
  end

  def valid?(_, _), do: false

  def lock_owned!(users) do
    lock_users!(Map.values(users))

    Repo.all(
      from(p in GlobalPassport,
        where: p.user_id in ^Map.values(users),
        order_by: p.user_id,
        lock: "FOR UPDATE"
      )
    )

    {:ok, :pass}
  end

  def delete_owned!(users, expected) do
    ensure_owned!(users, expected)
    ids = expected |> Map.values() |> Enum.map(&Map.fetch!(&1, "id"))
    {count, _} = Repo.delete_all(from(p in GlobalPassport, where: p.id in ^ids))
    if count != length(ids), do: Repo.rollback(:seed_permissions_changed)
    {:ok, :pass}
  end

  def provision_admins!(users, communities, expected) do
    communities
    |> Enum.sort_by(fn {_slug, id} -> id end)
    |> Enum.into(%{}, fn {slug, community_id} ->
      user_id = users[if(slug == "mock", do: "adminMock", else: "adminDev")]

      admin =
        Repo.one(
          from(a in CMS.Model.CommunityAdmin,
            where: a.user_id == ^user_id and a.community_id == ^community_id,
            lock: "FOR UPDATE"
          )
        ) ||
          Repo.rollback(:seed_admin_missing)

      recorded = Map.get(expected, slug)

      recorded =
        if is_map(recorded) and recorded["communityId"] != community_id and
             is_nil(Repo.get(CMS.Model.Community, recorded["communityId"])) do
          nil
        else
          recorded
        end

      case recorded do
        nil ->
          if admin.is_lord or admin.permissions != %{},
            do: Repo.rollback(:seed_unexpected_permissions)

          admin =
            admin
            |> Ecto.Changeset.change(is_lord: true, revision: admin.revision + 1)
            |> Repo.update!()

          {slug, admin_snapshot(admin)}

        recorded ->
          unless admin_snapshot(admin) == recorded,
            do: Repo.rollback(:seed_unexpected_permissions)

          {slug, recorded}
      end
    end)
  end

  def admins_valid?(users, communities, expected, cleaned?) when is_map(expected) do
    ids = Map.values(users)
    community_ids = Map.values(communities)

    admins =
      Repo.all(
        from(a in CMS.Model.CommunityAdmin,
          where: a.user_id in ^ids and a.community_id in ^community_ids
        )
      )

    if cleaned? do
      Enum.all?(admins, &(not &1.is_lord and &1.permissions == %{}))
    else
      actual = Map.new(admins, &{&1.id, admin_snapshot(&1)})
      recorded = Map.new(expected, fn {_slug, row} -> {row["id"], row} end)
      actual == recorded and map_size(recorded) == map_size(communities)
    end
  end

  def admins_valid?(_, _, _, _), do: false

  def clear_admins!(users, communities, expected) do
    unless admins_valid?(users, communities, expected, false),
      do: Repo.rollback(:seed_permissions_changed)

    ids = Enum.map(Map.values(expected), & &1["id"])

    {count, _} =
      Repo.update_all(from(a in CMS.Model.CommunityAdmin, where: a.id in ^ids),
        set: [is_lord: false, permissions: %{}],
        inc: [revision: 1]
      )

    if count != length(ids), do: Repo.rollback(:seed_permissions_changed)
    {:ok, :pass}
  end

  def with_temporary_root!(user_id, fun) when is_integer(user_id) and is_function(fun, 0) do
    unless Repo.in_transaction?(), do: raise("seed privilege transaction required")

    try do
      temporary_root!(user_id, fun)
    rescue
      error -> Repo.rollback({:seed_temporary_root_failed, error})
    end
  end

  defp temporary_root!(user_id, fun) do
    lock_users!([user_id])
    row = Repo.one(from(p in GlobalPassport, where: p.user_id == ^user_id, lock: "FOR UPDATE"))

    {temporary, original} =
      case row do
        nil ->
          created =
            %GlobalPassport{}
            |> GlobalPassport.changeset(%{user_id: user_id, is_root: true})
            |> Repo.insert!()

          {created, nil}

        %GlobalPassport{} = existing ->
          {count, _} =
            Repo.update_all(
              from(p in GlobalPassport,
                where: p.id == ^existing.id and p.revision == ^existing.revision
              ),
              set: [is_root: true]
            )

          if count != 1, do: Repo.rollback(:seed_permissions_changed)
          {%{existing | is_root: true}, existing}
      end

    case fun.() do
      {:error, reason} ->
        Repo.rollback(reason)

      result ->
        restore!(temporary, original)
        result
    end
  end

  def lock_resources!(manifest, bodies \\ []) do
    article_ids =
      (manifest["resources"] || %{})
      |> Map.values()
      |> Enum.map(& &1["articleId"])
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()
      |> Enum.sort()

    {referenced_ids, mentioned_users} = referenced_targets!(bodies)
    article_ids = Enum.sort(Enum.uniq(article_ids ++ referenced_ids))
    community_ids = (manifest["communities"] || %{}) |> Map.values() |> Enum.uniq()

    with {:ok, plan} <- MutationLock.lock_community_plan(article_ids, community_ids),
         {:ok, :pass} <- lock_article_keys(article_ids),
         {:ok, :pass} <- MutationLock.lock_article_rows(article_ids),
         {:ok, :pass} <- MutationLock.verify_community_plan(plan),
         {:ok, :pass} <- lock_mentioned_users!(manifest, bodies, mentioned_users),
         true <- referenced_targets!(bodies) == {referenced_ids, mentioned_users} do
      {:ok, :pass}
    else
      false -> Repo.rollback(:seed_mention_targets_changed)
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp referenced_targets!(bodies) do
    mentions =
      Enum.flat_map(bodies, fn {body, community_id} ->
        with true <- is_map(body) and is_integer(community_id),
             json when is_binary(json) <- Map.get(body, "json", Map.get(body, :json)),
             {:ok, ast} <- CMS.Artiment.PlateJSON.decode(json),
             {:ok, written} <- CMS.ArtimentMentions.Parser.mentions(ast),
             {:ok, mentions} <-
               CMS.ArtimentMentions.Capture.target_mentions(written, community_id) do
          mentions
        else
          _ -> Repo.rollback(:seed_invalid_mention_targets)
        end
      end)

    articles =
      Enum.flat_map(mentions, fn mention ->
        artiment = Map.get(mention, :artiment) || %{}
        parent = Map.get(mention, :parent_article) || %{}
        id = Map.get(artiment, :article_id) || Map.get(parent, :article_id)
        if is_binary(id), do: [id], else: []
      end)

    users =
      Enum.flat_map(mentions, fn mention ->
        if Map.get(mention, :mentioned_type) == :user and
             is_integer(Map.get(mention, :mentioned_id)) do
          [mention.mentioned_id]
        else
          []
        end
      end)

    {articles |> Enum.uniq() |> Enum.sort(), users |> Enum.uniq() |> Enum.sort()}
  end

  defp lock_mentioned_users!(_manifest, [], _users), do: {:ok, :pass}

  defp lock_mentioned_users!(manifest, _bodies, users) do
    ids = (Map.values(manifest["users"] || %{}) ++ users) |> Enum.uniq()
    lock_users!(ids)
    {:ok, :pass}
  end

  defp lock_article_keys(article_ids) do
    keys =
      Repo.all(
        from(a in CMS.Model.Article,
          left_join: b in CMS.Model.ArticleBinding,
          on: b.article_id == a.id,
          where: a.id in ^article_ids,
          select: {a.id, a.thread, b.community_id}
        )
      )
      |> Enum.flat_map(fn
        {_id, :doc, nil} ->
          []

        {id, thread, community_id} ->
          [MutationLock.key(%CMS.Model.Community{id: community_id || 0}, thread, id)]
      end)
      |> Enum.uniq()
      |> Enum.sort()

    Enum.each(keys, fn key -> {:ok, :acquired} = AdvisoryLock.acquire!(key) end)
    {:ok, :pass}
  end

  defp restore!(temporary, original) do
    query =
      from(p in GlobalPassport,
        where:
          p.id == ^temporary.id and p.user_id == ^temporary.user_id and
            p.revision == ^temporary.revision and p.is_root == true and
            p.permissions == ^temporary.permissions
      )

    {count, _} =
      if original do
        Repo.update_all(query, set: [is_root: original.is_root])
      else
        Repo.delete_all(query)
      end

    if count != 1, do: Repo.rollback(:seed_permissions_changed)
  end

  defp lock_users!(ids) do
    ids = Enum.sort(ids)

    locked =
      Repo.all(
        from(u in User, where: u.id in ^ids, order_by: u.id, lock: "FOR UPDATE", select: u.id)
      )

    if locked != ids, do: Repo.rollback(:seed_user_missing)
  end

  defp snapshot(row) do
    %{
      "id" => row.id,
      "userId" => row.user_id,
      "revision" => row.revision,
      "isRoot" => row.is_root,
      "permissions" => row.permissions
    }
  end

  defp admin_snapshot(row) do
    %{
      "id" => row.id,
      "userId" => row.user_id,
      "communityId" => row.community_id,
      "revision" => row.revision,
      "isLord" => row.is_lord,
      "permissions" => row.permissions
    }
  end
end
