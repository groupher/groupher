defmodule GroupherServer.CMS.Assets.Writer do
  @moduledoc """
  Write-side helpers for community assets and article refs.

  The write flow mirrors the storage model:

      upload service  ->  community_assets
                         /        |
      article cover --'         billing/counting
      editor block ---->  article_document_asset_refs

  The upload service owns bytes in object storage. This module records the
  uploaded object's URL/size and projects article usage into queryable rows.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.FrontDesk
  alias CMS.Model.{ArticleDocument, ArticleDocumentAssetRef, Community, CommunityAsset}
  alias Helper.{ORM, T}

  @body_usages ~w(inline attachment embed)a
  @cover_specs [
    %{usage: :cover, asset_key: :cover_asset, asset_id_key: :cover_asset_id},
    %{usage: :cover_dark, asset_key: :cover_asset_dark, asset_id_key: :cover_asset_dark_id}
  ]
  @all_usages ArticleDocumentAssetRef.usage_values()
  @asset_url_conflict_target {:unsafe_fragment,
                              "(community_id, url_hash) WHERE deleted_at IS NULL"}
  @asset_storage_conflict_target {:unsafe_fragment,
                                  "(community_id, storage, storage_key) WHERE storage_key IS NOT NULL AND deleted_at IS NULL"}

  @doc """
  Creates or updates an active community asset row for uploaded metadata.

  Active rows are deduplicated by URL hash, or by storage identity when both
  `storage` and `storage_key` are present. The optional user is stored as the
  uploader when available.

  ## Examples

      Writer.register(community, %{url: url, size_bytes: 2048}, user)
      #=> {:ok, %CommunityAsset{}}

      Writer.register(community, %{storage: "s3", storage_key: key, url: url, size_bytes: 2048})
      #=> {:ok, %CommunityAsset{}}

  """
  @spec register(Community.t(), map(), User.t() | nil) :: T.domain_res(CommunityAsset.t())
  def register(%Community{id: community_id}, attrs, user \\ nil) when is_map(attrs) do
    attrs =
      attrs
      |> Map.put(:community_id, community_id)
      |> put_uploader(user)
      |> put_default_status()
      |> put_default_asset_type()

    upsert_active_asset(attrs)
  end

  @doc """
  Soft-deletes one active community asset when it has no refs.

  The asset row is selected `FOR UPDATE` before the ref check. If any
  `article_document_asset_refs` row still points to the asset, deletion is
  rejected.

  ## Examples

      Writer.delete(community, asset.id)
      #=> {:ok, %CommunityAsset{status: :deleted}}

      Writer.delete(community, referenced_asset.id)
      #=> {:error, {:custom, "asset is still referenced"}}

  """
  @spec delete(Community.t(), T.id()) :: T.domain_res(CommunityAsset.t())
  def delete(%Community{id: community_id}, asset_id) do
    Repo.transaction(fn ->
      with {:ok, asset} <- find_active_asset_for_update(community_id, asset_id),
           false <- referenced?(asset),
           {:ok, asset} <-
             ORM.update(asset, %{
               status: :deleted,
               deleted_at: DateTime.utc_now(:second)
             }) do
        asset
      else
        true -> Repo.rollback({:custom, "asset is still referenced"})
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Synchronizes refs for an article using an explicit community boundary.

  The article document row is locked while body and cover refs are replaced, so
  concurrent syncs for the same article cannot interleave delete/insert steps.

  ## Examples

      Writer.sync_article_refs(community, post, %{
        asset_refs: [%{asset_id: asset.id, block_id: "image-1"}],
        cover_asset_id: cover_asset.id,
        cur_user: user
      })
      #=> {:ok, %{body: body_refs, cover: cover_refs}}

  """
  @spec sync_article_refs(Community.t(), T.article(), map()) :: T.domain_res(term())
  def sync_article_refs(%Community{id: community_id}, article, attrs) do
    do_sync_article_refs(community_id, article, attrs)
  end

  @doc """
  Synchronizes refs for an article using `article.community_id`.

  This variant keeps article create/update flows concise. If the article is not
  associated with a community, the sync is a no-op.

  ## Examples

      Writer.sync_article_refs(post, %{asset_refs: [%{asset_id: asset.id}]})
      #=> {:ok, %{body: body_refs, cover: cover_refs}}

      Writer.sync_article_refs(%{post | community_id: nil}, %{asset_refs: []})
      #=> {:ok, :pass}

  """
  @spec sync_article_refs(T.article(), map()) :: T.domain_res(term())
  def sync_article_refs(article, attrs) do
    case Map.get(article, :community_id) do
      nil -> {:ok, :pass}
      community_id -> do_sync_article_refs(community_id, article, attrs)
    end
  end

  @doc "Copies the complete asset-ref projection from one Article version to another."
  @spec copy_article_refs(T.article(), T.article()) :: T.domain_res(term())
  def copy_article_refs(source, target) do
    with {:ok, source_thread} <- FrontDesk.thread_of(source),
         {:ok, target_thread} <- FrontDesk.thread_of(target),
         true <- source_thread == target_thread,
         {:ok, source_document} <-
           ORM.find_by(ArticleDocument, article_id: source.id, thread: source_thread),
         {:ok, target_document} <-
           ORM.find_by(ArticleDocument, article_id: target.id, thread: target_thread) do
      Repo.transaction(fn ->
        ArticleDocumentAssetRef
        |> where([ref], ref.article_document_id == ^target_document.id)
        |> Repo.delete_all()

        source_refs =
          ArticleDocumentAssetRef
          |> where([ref], ref.article_document_id == ^source_document.id)
          |> Repo.all()

        Enum.reduce_while(source_refs, {:ok, []}, fn source_ref, {:ok, copied} ->
          attrs =
            source_ref
            |> Map.from_struct()
            |> Map.take([
              :asset_id,
              :usage,
              :block_id,
              :block_type,
              :position,
              :title,
              :alt,
              :source,
              :meta
            ])
            |> Map.merge(%{
              community_id: target.community_id,
              article_document_id: target_document.id,
              article_id: target.id,
              thread: target_thread
            })

          case ORM.create(ArticleDocumentAssetRef, attrs) do
            {:ok, ref} -> {:cont, {:ok, [ref | copied]}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)
        |> case do
          {:ok, copied} -> Enum.reverse(copied)
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      false -> {:error, {:custom, "Article asset refs can only copy within one thread"}}
      error -> error
    end
  end

  @doc """
  Removes all article-document asset refs for an article.

  The community asset rows remain intact; only usage projections are deleted.
  This is used by article deletion cleanup.

  ## Examples

      Writer.purge_article_refs(:post, post.id)
      #=> {:ok, {deleted_count, nil}}

  """
  @spec purge_article_refs(atom(), T.id()) :: T.domain_res(term())
  def purge_article_refs(thread, article_id) do
    ArticleDocumentAssetRef
    |> where([ref], ref.thread == ^thread and ref.article_id == ^article_id)
    |> Repo.delete_all()
    |> then(&{:ok, &1})
  end

  defp do_sync_article_refs(community_id, article, attrs) do
    case sync_requested?(attrs) do
      false ->
        {:ok, :pass}

      true ->
        Repo.transaction(fn ->
          with {:ok, thread} <- FrontDesk.thread_of(article),
               {:ok, document} <- find_article_document_for_update(thread, article.id),
               base <- base_ref_attrs(community_id, document, thread, article.id),
               user <- get_attr(attrs, :cur_user),
               {:ok, body_refs} <- sync_body_refs(document, base, attrs, user),
               {:ok, cover_refs} <- sync_cover_refs(document, base, attrs, user) do
            %{body: body_refs, cover: cover_refs}
          else
            {:error, reason} -> Repo.rollback(reason)
          end
        end)
    end
  end

  defp sync_requested?(attrs) when is_map(attrs) do
    has_attr?(attrs, :asset_refs) or has_attr?(attrs, :cover_asset) or
      has_attr?(attrs, :cover_asset_id) or has_attr?(attrs, :cover_asset_dark) or
      has_attr?(attrs, :cover_asset_dark_id) or removed_cover?(attrs)
  end

  defp sync_requested?(_), do: false

  defp removed_cover?(attrs),
    do: has_attr?(attrs, :cover_edit_info) and is_nil(get_attr(attrs, :cover_edit_info))

  defp sync_body_refs(document, base, attrs, user) do
    case has_attr?(attrs, :asset_refs) do
      false ->
        {:ok, []}

      true ->
        inputs = get_attr(attrs, :asset_refs) || []

        with {:ok, usages} <- replace_usages_for_inputs(inputs) do
          replace_refs(document, usages, inputs, base, user, &normalize_body_usage/1)
        end
    end
  end

  defp sync_cover_refs(document, base, attrs, user) do
    attrs
    |> cover_ref_specs()
    |> Enum.reduce_while({:ok, []}, fn {usage, inputs}, {:ok, acc} ->
      case replace_refs(document, [usage], inputs, base, user, &normalize_usage/1) do
        {:ok, refs} -> {:cont, {:ok, [refs | acc]}}
        {:error, _} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, refs} -> {:ok, refs |> Enum.reverse() |> List.flatten()}
      error -> error
    end
  end

  defp cover_ref_specs(attrs) do
    cond do
      removed_cover?(attrs) ->
        Enum.map(@cover_specs, &{&1.usage, []})

      true ->
        @cover_specs
        |> Enum.flat_map(fn spec ->
          if has_attr?(attrs, spec.asset_key) or has_attr?(attrs, spec.asset_id_key) do
            case cover_ref_input(attrs, spec) do
              nil -> [{spec.usage, []}]
              input -> [{spec.usage, [input]}]
            end
          else
            []
          end
        end)
    end
  end

  defp cover_ref_input(attrs, spec) do
    asset = get_attr(attrs, spec.asset_key)
    asset_id = get_attr(attrs, spec.asset_id_key)

    if is_nil(asset) and is_nil(asset_id) do
      nil
    else
      %{
        asset: asset,
        asset_id: asset_id,
        usage: spec.usage,
        source: "cover"
      }
    end
  end

  defp replace_refs(
         %ArticleDocument{id: document_id},
         usages,
         inputs,
         base,
         user,
         normalize_usage_fun
       ) do
    ArticleDocumentAssetRef
    |> where([ref], ref.article_document_id == ^document_id and ref.usage in ^usages)
    |> Repo.delete_all()

    inputs
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {input, index}, {:ok, acc} ->
      case create_ref(input, index, base, user, normalize_usage_fun) do
        {:ok, ref} -> {:cont, {:ok, acc ++ [ref]}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp replace_usages_for_inputs([]), do: {:ok, @body_usages}

  defp replace_usages_for_inputs(inputs) do
    inputs
    |> Enum.reduce_while({:ok, MapSet.new(@body_usages)}, fn input, {:ok, usage_set} ->
      case normalize_body_usage(get_attr(input, :usage)) do
        {:ok, usage} -> {:cont, {:ok, MapSet.put(usage_set, usage)}}
        {:error, _} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, usage_set} -> {:ok, MapSet.to_list(usage_set)}
      {:error, _} = error -> error
    end
  end

  defp create_ref(input, index, %{community_id: community_id} = base, user, normalize_usage_fun)
       when is_map(input) do
    with {:ok, usage} <- normalize_usage_fun.(get_attr(input, :usage)),
         {:ok, asset} <- resolve_asset(community_id, input, user) do
      attrs =
        base
        |> Map.merge(%{
          asset_id: asset.id,
          usage: usage,
          block_id: get_attr(input, :block_id),
          block_type: get_attr(input, :block_type),
          position: get_attr(input, :position) || index,
          title: get_attr(input, :title),
          alt: get_attr(input, :alt),
          source: get_attr(input, :source),
          meta: get_attr(input, :meta) || %{}
        })

      ORM.create(ArticleDocumentAssetRef, attrs)
    end
  end

  defp create_ref(_, _, _, _, _), do: {:error, {:custom, "asset ref is invalid"}}

  defp resolve_asset(community_id, input, user) do
    asset_id = get_attr(input, :asset_id)
    asset_attrs = get_attr(input, :asset)

    cond do
      not is_nil(asset_id) and is_map(asset_attrs) ->
        {:error, {:custom, "asset_id and asset are mutually exclusive"}}

      not is_nil(asset_id) ->
        find_active_asset_for_update(community_id, asset_id)

      is_map(asset_attrs) ->
        with {:ok, asset} <- register(%Community{id: community_id}, asset_attrs, user) do
          find_active_asset_for_update(community_id, asset.id)
        end

      true ->
        {:error, {:custom, "asset is required"}}
    end
  end

  defp find_active_asset_for_update(community_id, asset_id) do
    community_id
    |> CommunityAsset.active_query(asset_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, {:not_exist, "asset not found"}}
      asset -> {:ok, asset}
    end
  end

  defp upsert_active_asset(attrs) do
    attrs
    |> upsert_identity()
    |> then(&insert_active_asset(attrs, &1))
    |> case do
      {:ok, asset} -> {:ok, asset}
      {:error, %Ecto.Changeset{} = changeset} -> retry_active_asset_upsert(attrs, changeset)
    end
  end

  defp insert_active_asset(attrs, identity) do
    changeset = CommunityAsset.changeset(%CommunityAsset{}, attrs)

    set_fields =
      changeset.changes
      |> Map.drop(conflict_fields(identity))
      |> Map.put(:updated_at, DateTime.utc_now(:second))
      |> Enum.to_list()

    opts = [
      on_conflict: [set: set_fields],
      conflict_target: conflict_target(identity),
      returning: true
    ]

    opts =
      if Repo.in_transaction?() do
        Keyword.put(opts, :mode, :savepoint)
      else
        opts
      end

    Repo.insert(changeset, opts)
  end

  defp retry_active_asset_upsert(attrs, changeset) do
    cond do
      unique_constraint_error?(changeset, :community_assets_community_url_hash_index) ->
        insert_active_asset(attrs, :url_hash)

      storage_identity?(attrs) and
          unique_constraint_error?(changeset, :community_assets_community_storage_key_index) ->
        insert_active_asset(attrs, :storage_key)

      true ->
        {:error, changeset}
    end
  end

  defp upsert_identity(attrs) do
    if storage_identity?(attrs), do: :storage_key, else: :url_hash
  end

  defp storage_identity?(attrs) do
    is_binary(get_attr(attrs, :storage)) and is_binary(get_attr(attrs, :storage_key))
  end

  defp conflict_target(:storage_key), do: @asset_storage_conflict_target
  defp conflict_target(:url_hash), do: @asset_url_conflict_target

  defp conflict_fields(:storage_key), do: [:community_id, :storage, :storage_key]
  defp conflict_fields(:url_hash), do: [:community_id, :url_hash]

  defp unique_constraint_error?(%Ecto.Changeset{errors: errors}, constraint_name) do
    constraint_name = to_string(constraint_name)

    Enum.any?(errors, fn {_field, {_message, opts}} ->
      opts[:constraint] == :unique and opts[:constraint_name] == constraint_name
    end)
  end

  defp referenced?(%CommunityAsset{id: asset_id}) do
    ArticleDocumentAssetRef
    |> where([ref], ref.asset_id == ^asset_id)
    |> Repo.exists?()
  end

  defp find_article_document_for_update(thread, article_id) do
    ArticleDocument
    |> where([document], document.thread == ^thread and document.article_id == ^article_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, {:not_exist, "article document not found"}}
      document -> {:ok, document}
    end
  end

  defp base_ref_attrs(community_id, %ArticleDocument{id: document_id}, thread, article_id) do
    %{
      community_id: community_id,
      article_document_id: document_id,
      thread: thread,
      article_id: article_id
    }
  end

  defp put_uploader(attrs, %User{id: user_id}), do: Map.put(attrs, :uploader_id, user_id)
  defp put_uploader(attrs, _), do: attrs

  defp put_default_status(attrs) do
    case has_attr?(attrs, :status) do
      true -> attrs
      false -> Map.put(attrs, :status, :active)
    end
  end

  defp put_default_asset_type(attrs) do
    case has_attr?(attrs, :asset_type) do
      true -> attrs
      false -> Map.put(attrs, :asset_type, guessed_asset_type(get_attr(attrs, :mime_type)))
    end
  end

  defp guessed_asset_type("image/" <> _), do: :image
  defp guessed_asset_type("video/" <> _), do: :video
  defp guessed_asset_type("audio/" <> _), do: :audio
  defp guessed_asset_type(_), do: :file

  defp normalize_usage(nil), do: {:ok, :inline}
  defp normalize_usage(usage) when usage in @all_usages, do: {:ok, usage}

  defp normalize_usage(usage) when is_binary(usage) do
    @all_usages
    |> Enum.find(&(to_string(&1) == usage))
    |> case do
      nil -> {:error, {:custom, "asset usage is invalid"}}
      usage -> {:ok, usage}
    end
  end

  defp normalize_usage(_), do: {:error, {:custom, "asset usage is invalid"}}

  defp normalize_body_usage(usage) do
    with {:ok, usage} <- normalize_usage(usage),
         true <- usage in @body_usages do
      {:ok, usage}
    else
      false -> {:error, {:custom, "asset usage is invalid"}}
      {:error, _} = error -> error
    end
  end

  defp has_attr?(map, key) when is_map(map),
    do: Map.has_key?(map, key) or Map.has_key?(map, Atom.to_string(key))

  defp get_attr(map, key) when is_map(map) do
    case Map.fetch(map, key) do
      {:ok, value} -> value
      :error -> Map.get(map, Atom.to_string(key))
    end
  end

  defp get_attr(_, _), do: nil
end
