defmodule GroupherServer.CMS.Press.ConfigWriter do
  @moduledoc """
  Persists Press configuration and its Activity fact in one transaction.

  Cache invalidation runs after commit and remains best-effort.

  Business position:

      CMS.Press facade
        -> Press.ConfigWriter
        -> Repo transaction / Activity
        -> Press.Invalidation
  """

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Ecto.Multi
  alias Activity.EventRef
  alias Accounts.Model.User
  alias CMS.Model.{Community, PressConfig}
  alias CMS.Press.{Invalidation, Reader}
  alias Helper.Later

  @doc "Updates persisted Press config and records the changed fields."
  @spec update(Community.t() | String.t(), map(), User.t() | nil) ::
          {:ok, PressConfig.t()} | {:error, term()}
  def update(community, attrs, actor) do
    with {:ok, community} <- Reader.internal_community(community),
         {:ok, current} <- Reader.config(community) do
      attrs = normalize_attrs(attrs)

      operation_ref =
        EventRef.derive({:press_config_update, community.id, current.revision, attrs})

      changeset =
        case current do
          %PressConfig{id: id} = config when not is_nil(id) ->
            PressConfig.changeset(config, Map.put(attrs, :revision, config.revision + 1))

          _ ->
            PressConfig.changeset(
              %PressConfig{},
              current
              |> Map.take(config_fields())
              |> Map.merge(attrs)
              |> Map.merge(%{community_id: community.id, revision: 1})
            )
        end

      Multi.new()
      |> Multi.insert_or_update(:config, changeset)
      |> Multi.run(:activity, fn _, %{config: config} ->
        changed_payload = Map.take(changeset.changes, config_fields())

        Activity.log(config, :config_updated,
          actor: actor,
          source: :admin,
          operation_ref: operation_ref,
          stream_ref: community.slug,
          occurred_at: config.updated_at,
          payload: changed_payload,
          changed_fields: Map.keys(changed_payload),
          metadata: %{revision: config.revision}
        )
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{config: config}} ->
          Later.run({Invalidation, :invalidate, [community.slug]})
          {:ok, config}

        {:error, _step, reason, _changes} ->
          {:error, reason}
      end
    end
  end

  defp normalize_attrs(attrs) do
    attrs = Enum.into(attrs, %{})

    case Map.fetch(attrs, :feed_threads) do
      {:ok, threads} -> Map.put(attrs, :feed_threads, Enum.map(threads, &to_string/1))
      :error -> attrs
    end
  end

  defp config_fields do
    [
      :markdown_enabled,
      :feed_enabled,
      :feed_type,
      :feed_count,
      :feed_threads,
      :llms_enabled,
      :sitemap_enabled
    ]
  end
end
