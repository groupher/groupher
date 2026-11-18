defmodule GroupherServer.CMS.Assets.Refs do
  @moduledoc """
  Persistence and projection helpers for Article asset references.

  The write flow mirrors the storage model:

      upload service  ->  community_assets
                         /        |
      article cover --'         billing/counting
      editor block ---->  article_asset_refs

  The upload service owns bytes in object storage. This module records the
  uploaded object's URL/size and projects article usage into queryable rows.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User

  alias CMS.Assets.{Completeness, Persist}
  alias CMS.Assets.ErrorCat, as: AssetErrorCat
  alias CMS.Gate.ErrorCat, as: GateErrorCat

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleWorkingCopy,
    Community,
    CommunityAsset
  }

  @cover_specs [
    %{
      usage: :cover,
      asset_key: :cover_asset,
      asset_id_key: :cover_asset_id,
      url_key: :cover_url
    },
    %{
      usage: :cover_dark,
      asset_key: :cover_asset_dark,
      asset_id_key: :cover_asset_dark_id,
      url_key: :cover_url_dark
    }
  ]
  @all_usages ArticleAssetRef.usage_values()

  @doc "Rebuilds all asset refs from the server-validated complete WorkingCopy content."
  def sync_working_copy_refs(
        %Community{id: community_id},
        %Article{id: article_id},
        %ArticleWorkingCopy{article_id: article_id} = work,
        attrs,
        %User{} = user
      ) do
    do_sync_working_copy_refs(community_id, work, attrs, user, :derived)
  end

  def sync_working_copy_refs(_community, _article, _work, _attrs, _user) do
    {:error, GateErrorCat.permission_denied()}
  end

  @doc "Rebuilds refs with already selected cover references inside an admitted Doc merge."
  def sync_merged_working_copy_refs(
        %Community{id: community_id},
        %Article{id: article_id, thread: :doc},
        %ArticleWorkingCopy{article_id: article_id} = work,
        attrs,
        cover_refs,
        %User{} = user
      ) do
    with {:ok, refs} <- validate_selected_cover_refs(cover_refs) do
      do_sync_working_copy_refs(community_id, work, attrs, user, {:selected, refs})
    end
  end

  def sync_merged_working_copy_refs(_, _, _, _, _, _) do
    {:error, GateErrorCat.permission_denied()}
  end

  defp do_sync_working_copy_refs(community_id, work, attrs, user, selection) do
    working_copy_id = work.id

    with true <- Repo.in_transaction?(),
         {:ok, _} <- Completeness.lock_scope(community_id),
         {:ok, _} <- lock_working_copy(working_copy_id),
         {:ok, refs} <- working_copy_asset_refs(work, attrs, selection) do
      ArticleAssetRef
      |> where([ref], ref.working_copy_id == ^working_copy_id)
      |> Repo.delete_all()

      Enum.with_index(refs)
      |> Enum.reduce_while({:ok, []}, fn {input, index}, {:ok, acc} ->
        case create_working_copy_ref(community_id, working_copy_id, input, user, index) do
          {:ok, ref} -> {:cont, {:ok, [ref | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
      |> case do
        {:ok, saved} -> {:ok, Enum.reverse(saved)}
        {:error, reason} -> {:error, reason}
      end
    else
      false -> {:error, :transaction_required}
      {:error, _reason} = error -> error
    end
  end

  @doc "Copies owner refs as independent immutable Snapshot membership rows."
  def copy_working_copy_refs_to_snapshot(working_copy_id, snapshot_id)
      when is_binary(working_copy_id) and is_binary(snapshot_id) do
    copy_owner_refs(:working_copy_id, working_copy_id, :snapshot_id, snapshot_id)
  end

  @doc "Copies Snapshot asset membership into independent mutable WorkingCopy rows."
  def copy_snapshot_refs_to_working_copy(snapshot_id, working_copy_id)
      when is_binary(snapshot_id) and is_binary(working_copy_id) do
    copy_owner_refs(:snapshot_id, snapshot_id, :working_copy_id, working_copy_id)
  end

  @doc "Returns all asset refs owned by one WorkingCopy."
  def working_copy_refs(working_copy_id) when is_binary(working_copy_id) do
    ArticleAssetRef
    |> where([ref], ref.working_copy_id == ^working_copy_id)
    |> order_by([ref], asc: ref.position, asc: ref.inserted_at, asc: ref.id)
    |> Repo.all()
  end

  @doc "Returns all asset refs owned by one immutable Snapshot."
  def snapshot_refs(snapshot_id) when is_binary(snapshot_id) do
    ArticleAssetRef
    |> where([ref], ref.snapshot_id == ^snapshot_id)
    |> order_by([ref], asc: ref.position, asc: ref.inserted_at, asc: ref.id)
    |> Repo.all()
  end

  defp create_working_copy_ref(community_id, working_copy_id, input, user, index)
       when is_map(input) do
    with {:ok, usage} <- normalize_usage(get_attr(input, :usage)),
         {:ok, asset} <- resolve_asset(community_id, input, user) do
      attrs = %{
        community_id: community_id,
        asset_id: asset.id,
        working_copy_id: working_copy_id,
        usage: usage,
        block_id: get_attr(input, :block_id),
        block_type: get_attr(input, :block_type),
        position: get_attr(input, :position) || index,
        title: get_attr(input, :title),
        alt: get_attr(input, :alt),
        source: get_attr(input, :source),
        meta: get_attr(input, :meta) || %{}
      }

      %ArticleAssetRef{} |> ArticleAssetRef.changeset(attrs) |> Repo.insert()
    end
  end

  defp create_working_copy_ref(_community_id, _working_copy_id, _input, _user, _index) do
    {:error, AssetErrorCat.custom("asset ref is invalid")}
  end

  defp lock_working_copy(working_copy_id) do
    ArticleWorkingCopy
    |> where([work], work.id == ^working_copy_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      %ArticleWorkingCopy{} -> {:ok, :pass}
      nil -> {:error, AssetErrorCat.not_exist("article working copy not found")}
    end
  end

  defp working_copy_asset_refs(%ArticleWorkingCopy{} = work, attrs, selection) do
    explicit_refs =
      if has_attr?(attrs, :asset_refs),
        do: get_attr(attrs, :asset_refs),
        else: existing_working_copy_attachment_refs(work.id)

    with {:ok, body} <- decode_working_copy_body(CMS.Articles.Body.document(work).json),
         {:ok, thread_refs} <- typed_cover_refs(work),
         {:ok, cover_edit_refs} <- cover_edit_refs(work.cover_edit_working_copy_id),
         {:ok, explicit_refs} <- normalize_explicit_refs(explicit_refs),
         {:ok, selected_cover_refs} <- selected_cover_refs(work, attrs, thread_refs, selection) do
      body_refs = collect_body_asset_refs(body)
      {:ok, body_refs ++ selected_cover_refs ++ cover_edit_refs ++ explicit_refs}
    end
  end

  defp validate_selected_cover_refs(refs) when is_list(refs) do
    usages = Enum.map(refs, &get_attr(&1, :usage))

    if Enum.all?(
         refs,
         &(is_map(&1) and is_integer(Map.get(&1, :asset_id)) and
             Map.has_key?(&1, :usage))
       ) and
         Enum.all?(usages, &(&1 in [:cover, :cover_dark])) and
         length(usages) == length(Enum.uniq(usages)) do
      {:ok,
       Enum.map(
         refs,
         &Map.take(&1, ~w(asset_id usage position block_id block_type alt title source meta)a)
       )}
    else
      {:error, AssetErrorCat.custom("selected Doc cover refs are invalid")}
    end
  end

  defp validate_selected_cover_refs(_) do
    {:error, AssetErrorCat.custom("selected Doc cover refs are invalid")}
  end

  defp existing_working_copy_attachment_refs(working_copy_id) do
    ArticleAssetRef
    |> where(
      [ref],
      ref.working_copy_id == ^working_copy_id and ref.usage == :attachment and
        (is_nil(ref.source) or ref.source != "plate")
    )
    |> order_by([ref], asc: ref.position, asc: ref.inserted_at, asc: ref.id)
    |> Repo.all()
    |> Enum.map(fn ref ->
      %{
        asset_id: ref.asset_id,
        usage: ref.usage,
        block_id: ref.block_id,
        block_type: ref.block_type,
        position: ref.position,
        title: ref.title,
        alt: ref.alt,
        source: ref.source,
        meta: ref.meta
      }
    end)
  end

  defp normalize_explicit_refs(nil), do: {:ok, []}

  defp normalize_explicit_refs(refs) when is_list(refs) do
    cond do
      Enum.any?(
        refs,
        &(normalize_explicit_asset_usage(get_attr(&1, :usage)) != {:ok, :attachment})
      ) ->
        {:error, AssetErrorCat.custom("explicit Article asset refs must be attachments")}

      Enum.any?(refs, &(get_attr(&1, :source) == "plate")) ->
        {:error,
         AssetErrorCat.custom("explicit Article asset refs cannot use the reserved plate source")}

      true ->
        {:ok, refs}
    end
  end

  defp normalize_explicit_refs(_refs) do
    {:error, AssetErrorCat.custom("Article asset refs must be a list")}
  end

  defp normalize_explicit_asset_usage(:attachment), do: {:ok, :attachment}
  defp normalize_explicit_asset_usage("attachment"), do: {:ok, :attachment}

  defp normalize_explicit_asset_usage(_usage) do
    {:error, AssetErrorCat.custom("explicit Article asset refs must be attachments")}
  end

  defp cover_ref_input(attrs, spec) do
    asset = get_attr(attrs, spec.asset_key)
    asset_id = get_attr(attrs, spec.asset_id_key)

    if is_nil(asset) and is_nil(asset_id) do
      nil
    else
      %{asset: asset, asset_id: asset_id, usage: spec.usage, source: "cover"}
    end
  end

  defp selected_cover_refs(_work, _attrs, _thread_refs, {:selected, refs}), do: {:ok, refs}

  defp selected_cover_refs(work, attrs, thread_refs, :derived) do
    Enum.reduce_while(@cover_specs, {:ok, []}, fn spec, {:ok, acc} ->
      cond do
        has_attr?(attrs, spec.asset_key) or has_attr?(attrs, spec.asset_id_key) ->
          case cover_ref_input(attrs, spec) do
            nil -> {:cont, {:ok, acc}}
            input -> {:cont, {:ok, acc ++ [input]}}
          end

        has_attr?(attrs, spec.url_key) ->
          refs = Enum.filter(thread_refs, &(get_attr(&1, :usage) == spec.usage))
          {:cont, {:ok, acc ++ refs}}

        true ->
          refs = existing_working_copy_cover_refs(work.id, spec.usage)
          {:cont, {:ok, acc ++ refs}}
      end
    end)
  end

  defp existing_working_copy_cover_refs(working_copy_id, usage) do
    ArticleAssetRef
    |> where(
      [ref],
      ref.working_copy_id == ^working_copy_id and ref.usage == ^usage
    )
    |> order_by([ref], asc: ref.position, asc: ref.inserted_at, asc: ref.id)
    |> Repo.all()
    |> Enum.map(fn ref ->
      %{
        asset_id: ref.asset_id,
        usage: ref.usage,
        position: ref.position,
        title: ref.title,
        alt: ref.alt,
        source: ref.source,
        meta: ref.meta
      }
    end)
  end

  defp decode_working_copy_body(body_json) when is_binary(body_json) do
    case Jason.decode(body_json) do
      {:ok, body} when is_list(body) -> {:ok, body}
      _ -> {:error, AssetErrorCat.custom("Article WorkingCopy body is invalid")}
    end
  end

  defp typed_cover_refs(%ArticleWorkingCopy{id: working_copy_id, article_id: article_id}) do
    case Repo.get(Article, article_id) do
      %Article{thread: :ticket} ->
        {:ok, []}

      %Article{thread: :doc} ->
        case Repo.get_by(CMS.Model.ArticleWorkingCopyDoc, working_copy_id: working_copy_id) do
          nil -> {:error, AssetErrorCat.not_exist("Article WorkingCopy thread fields not found")}
          row -> {:ok, cover_url_refs(row.cover_url, row.cover_url_dark)}
        end

      %Article{thread: thread} ->
        {model, _fields} = working_copy_typed_model(thread)

        case Repo.get_by(model, working_copy_id: working_copy_id) do
          nil -> {:error, AssetErrorCat.not_exist("Article WorkingCopy thread fields not found")}
          row -> {:ok, cover_url_refs(row.cover_url, row.cover_url_dark)}
        end

      nil ->
        {:error, AssetErrorCat.not_exist("Article not found")}
    end
  end

  defp working_copy_typed_model(:post) do
    {CMS.Model.ArticleWorkingCopyPost, [:cover_url, :cover_url_dark]}
  end

  defp working_copy_typed_model(:blog) do
    {CMS.Model.ArticleWorkingCopyBlog, [:cover_url, :cover_url_dark]}
  end

  defp working_copy_typed_model(:changelog) do
    {CMS.Model.ArticleWorkingCopyChangelog, [:cover_url, :cover_url_dark]}
  end

  defp cover_url_refs(light, dark) do
    cover_ref(:cover, light) ++ cover_ref(:cover_dark, dark)
  end

  defp cover_ref(_usage, nil), do: []

  defp cover_ref(usage, url) when is_binary(url) do
    case asset_public_ref(url) do
      nil -> []
      public_ref -> [%{asset_public_ref: public_ref, usage: usage, source: "article_cover"}]
    end
  end

  defp cover_edit_refs(nil), do: {:ok, []}

  defp cover_edit_refs(id) do
    case Repo.get(CMS.Model.CoverEditWorkingCopy, id) do
      nil ->
        {:error, AssetErrorCat.not_exist("CoverEdit WorkingCopy not found")}

      cover ->
        refs =
          cover.light
          |> cover_canvas_refs(:cover)
          |> Kernel.++(cover_canvas_refs(cover.dark, :cover_dark))

        {:ok, refs}
    end
  end

  defp cover_canvas_refs(canvas, usage) do
    collect_explicit_asset_refs(canvas, :inline, "cover_edit_#{usage}")
  end

  defp collect_body_asset_refs(body), do: walk_body_assets(body, 0, []) |> Enum.reverse()

  defp walk_body_assets(value, _position, refs) when not is_map(value) and not is_list(value) do
    refs
  end

  defp walk_body_assets(values, position, refs) when is_list(values) do
    Enum.reduce(values, {position, refs}, fn value, {next_position, acc} ->
      next = walk_body_assets(value, next_position, acc)
      {next_position + 1, next}
    end)
    |> elem(1)
  end

  defp walk_body_assets(value, position, refs) when is_map(value) do
    type = get_attr(value, :type)
    usage = body_usage(type)

    public_ref =
      explicit_asset_ref(value) ||
        if(usage, do: asset_public_ref(get_attr(value, :url) || get_attr(value, :src)))

    next_refs =
      if public_ref && usage do
        [
          %{
            asset_public_ref: public_ref,
            usage: usage,
            block_id: get_attr(value, :id),
            block_type: type,
            position: position,
            source: "plate"
          }
          | refs
        ]
      else
        refs
      end

    value
    |> Map.values()
    |> Enum.reduce(next_refs, &walk_body_assets(&1, position, &2))
  end

  defp collect_explicit_asset_refs(value, usage, source) do
    walk_explicit_assets(value, usage, source, []) |> Enum.reverse()
  end

  defp walk_explicit_assets(values, usage, source, refs) when is_list(values) do
    Enum.reduce(values, refs, &walk_explicit_assets(&1, usage, source, &2))
  end

  defp walk_explicit_assets(value, usage, source, refs) when is_map(value) do
    ref =
      explicit_asset_ref(value) ||
        asset_public_ref(get_attr(value, :url) || get_attr(value, :src))

    next_refs =
      if ref,
        do: [%{asset_public_ref: ref, usage: usage, source: source} | refs],
        else: refs

    value |> Map.values() |> Enum.reduce(next_refs, &walk_explicit_assets(&1, usage, source, &2))
  end

  defp walk_explicit_assets(_value, _usage, _source, refs), do: refs

  defp explicit_asset_ref(value) do
    get_attr(value, :assetPublicRef) || get_attr(value, :asset_public_ref) ||
      get_attr(value, :public_ref)
  end

  defp body_usage(type) when type in ["img", "image"], do: :inline
  defp body_usage(type) when type in ["attachment", "file"], do: :attachment
  defp body_usage(type) when type in ["embed", "video", "audio"], do: :embed
  defp body_usage(_type), do: nil

  defp asset_public_ref(value) when is_binary(value) do
    case URI.parse(value).path do
      path when is_binary(path) ->
        case Enum.chunk_every(String.split(path, "/", trim: true), 2, 1, :discard)
             |> Enum.find_value(fn
               ["a", public_ref] -> public_ref
               _ -> nil
             end) do
          ref when is_binary(ref) and ref != "" -> ref
          _ -> nil
        end

      _ ->
        nil
    end
  end

  defp asset_public_ref(_value), do: nil

  defp load_active_asset_by_public_ref(community_id, public_ref)
       when is_binary(public_ref) and public_ref != "" do
    community_id
    |> CommunityAsset.active_query()
    |> where([asset], asset.public_ref == ^public_ref)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, AssetErrorCat.not_exist("asset not found")}
      asset -> {:ok, asset}
    end
  end

  defp load_active_asset_by_public_ref(_community_id, _public_ref) do
    {:error, AssetErrorCat.custom("managed Article asset has no public ref")}
  end

  defp copy_owner_refs(source_field, source_id, target_field, target_id) do
    if Repo.in_transaction?() do
      refs =
        ArticleAssetRef
        |> where([ref], field(ref, ^source_field) == ^source_id)
        |> order_by([ref], asc: ref.position, asc: ref.inserted_at, asc: ref.id)
        |> Repo.all()

      Enum.reduce_while(refs, {:ok, []}, fn ref, {:ok, copied} ->
        attrs =
          ref
          |> Map.from_struct()
          |> Map.take(
            ~w(community_id asset_id usage block_id block_type position title alt source meta)a
          )
          |> Map.put(target_field, target_id)

        case %ArticleAssetRef{} |> ArticleAssetRef.changeset(attrs) |> Repo.insert() do
          {:ok, copied_ref} -> {:cont, {:ok, [copied_ref | copied]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
      |> case do
        {:ok, copied} -> {:ok, Enum.reverse(copied)}
        {:error, _reason} = error -> error
      end
    else
      {:error, :transaction_required}
    end
  end

  defp resolve_asset(community_id, input, user) do
    asset_id = get_attr(input, :asset_id)
    asset_attrs = get_attr(input, :asset)
    public_ref = get_attr(input, :asset_public_ref)

    cond do
      not is_nil(public_ref) and (not is_nil(asset_id) or is_map(asset_attrs)) ->
        {:error,
         AssetErrorCat.custom("asset_public_ref and asset identity are mutually exclusive")}

      not is_nil(public_ref) ->
        load_active_asset_by_public_ref(community_id, public_ref)

      not is_nil(asset_id) and is_map(asset_attrs) ->
        {:error, AssetErrorCat.custom("asset_id and asset are mutually exclusive")}

      not is_nil(asset_id) ->
        load_active_asset_for_update(community_id, asset_id)

      is_map(asset_attrs) ->
        with {:ok, asset} <-
               Persist.register(%Community{id: community_id}, asset_attrs, user) do
          load_active_asset_for_update(community_id, asset.id)
        end

      true ->
        {:error, AssetErrorCat.custom("asset is required")}
    end
  end

  defp load_active_asset_for_update(community_id, asset_id) do
    community_id
    |> CommunityAsset.active_query(asset_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      nil -> {:error, AssetErrorCat.not_exist("asset not found")}
      asset -> {:ok, asset}
    end
  end

  defp normalize_usage(nil), do: {:ok, :inline}
  defp normalize_usage(usage) when usage in @all_usages, do: {:ok, usage}

  defp normalize_usage(usage) when is_binary(usage) do
    @all_usages
    |> Enum.find(&(to_string(&1) == usage))
    |> case do
      nil -> {:error, AssetErrorCat.custom("asset usage is invalid")}
      usage -> {:ok, usage}
    end
  end

  defp normalize_usage(_), do: {:error, AssetErrorCat.custom("asset usage is invalid")}

  defp has_attr?(map, key) when is_map(map) do
    Map.has_key?(map, key) or Map.has_key?(map, Atom.to_string(key))
  end

  defp get_attr(map, key) when is_map(map) do
    case Map.fetch(map, key) do
      {:ok, value} -> value
      :error -> Map.get(map, Atom.to_string(key))
    end
  end

  defp get_attr(_, _), do: nil
end
