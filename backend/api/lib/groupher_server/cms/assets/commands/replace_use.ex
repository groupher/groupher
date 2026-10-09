defmodule GroupherServer.CMS.Assets.Commands.ReplaceUse do
  @moduledoc """
  Replaces one asset locator in a mutable Article Draft.

  The command validates the observed Draft version and the old asset reference,
  then updates the Draft and its Draft-owned `ArticleAssetRef` rows in the same
  command transaction. Revision-owned refs are never selected by this module.

      CMS.Assets facade
        -> ReplaceUse command
        -> Gate-authorized Draft update
        -> ArticleAssetRef synchronization
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Draft.Store
  alias CMS.Articles.Bindings
  alias CMS.Assets.{Query, Writer}
  alias CMS.{Command, ErrorCat}
  alias CMS.FrontDesk
  alias CMS.Model.{Article, ArticleAssetRef, ArticleDraft, Community, CommunityAsset}
  alias CMS.Assets.Commands.ReplaceUseConfirmation, as: Confirmation

  @doc "Replaces one Draft-owned asset use without mutating an immutable Revision.

  User retries use a UUID command identity and the Receipt path. ReplacementPlan
  applies use a stable `{:workflow, step_ref}` identity; it never manufactures a
  user command id for a locator. A nil identity remains only for the legacy direct
  service helper and is not a GraphQL mutation path."
  @spec execute(
          map() | Article.t(),
          map(),
          User.t(),
          Ecto.UUID.t() | {:workflow, String.t()} | nil
        ) ::
          {:ok, map()} | {:error, term()}
  def execute(article_or_projection, attrs, %User{} = user, command_id) when is_map(attrs) do
    with {:ok, article} <- load_article(article_or_projection),
         {:ok, %{community: %Community{} = community}} <-
           binding_context(article, article_or_projection) do
      params = Map.drop(attrs, [:command_id, :cur_user, :step_ref])

      if is_nil(command_id) do
        with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(user) do
          replace_in_draft(article, community, params, author, user)
        end
      else
        case command_id do
          {:workflow, workflow_ref} when is_binary(workflow_ref) and workflow_ref != "" ->
            with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(user),
                 {:ok, result} <- replace_in_draft(article, community, params, author, user) do
              {:ok, Map.put(result, :workflow_ref, workflow_ref)}
            end

          _ ->
            execute_command(article, community, params, user, command_id)
        end
      end
    else
      {:error, _reason} = error -> error
    end
  end

  defp execute_command(article, community, params, user, command_id) do
    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :article_replace_asset,
      target: article,
      params: params
    }

    with {:ok, confirmation} <-
           Command.execute(command,
             action: &replace_action(&1, community),
             confirmation: Confirmation
           ) do
      present_confirmation(confirmation)
    end
  end

  defp replace_action(
         %{actor: user, target: article, params: params, command_id: command_id},
         community
       ) do
    with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(user),
         {:ok, result} <- replace_in_draft(article, community, params, author, user) do
      {:ok,
       %Confirmation{
         data:
           result
           |> Map.take([
             :article_id,
             :draft_version,
             :ref_id,
             :usage,
             :from_asset_id,
             :to_asset_id
           ])
           |> Map.put(:command_id, command_id)
           |> Map.new(fn {key, value} ->
             {to_string(key), if(is_atom(value), do: Atom.to_string(value), else: value)}
           end)
       }}
    end
  end

  defp replace_in_draft(article, community, attrs, author, user) do
    CMS.Gate.with_community_check(user, :edit, community, article, fn canonical ->
      with {:ok, draft} <- Store.ensure_from_public(canonical, author),
           {:ok, _} <- expected_version(attrs, draft.version),
           {:ok, ref} <- locate_ref(draft, attrs),
           {:ok, target_asset} <- active_asset(community.id, value(attrs, :to_asset_id)),
           {:ok, _} <- same_asset(ref, value(attrs, :from_asset_id)),
           {:ok, _} <- replacement_body_bag_required(ref, attrs),
           {:ok, updated_draft} <-
             Store.update(
               canonical,
               draft_attrs(attrs, draft),
               author,
               expected_version: draft.version
             ),
           {:ok, _refs} <-
             Writer.sync_refs(
               community,
               canonical,
               replacement_refs(draft, ref, target_asset)
             ) do
        {:ok,
         %{
           article_id: canonical.id,
           draft_version: updated_draft.version,
           ref_id: ref.id,
           usage: ref.usage,
           from_asset_id: ref.asset_id,
           to_asset_id: target_asset.id
         }}
      end
    end)
  end

  defp draft_attrs(attrs, _draft) do
    case value(attrs, :body_bag) do
      nil -> %{}
      body_bag -> %{body_bag: body_bag}
    end
  end

  defp replacement_refs(draft, ref, target_asset) do
    if ref.usage in [:cover, :cover_dark] do
      cover_key = if ref.usage == :cover, do: :cover_asset_id, else: :cover_asset_dark_id
      %{cover_key => target_asset.id}
    else
      refs = Writer.draft_refs(draft.body_draft_id)

      %{asset_refs: Enum.map(refs, &ref_input(&1, ref.id, target_asset.id))}
    end
  end

  defp replacement_body_bag_required(%ArticleAssetRef{usage: usage}, _attrs)
       when usage in [:cover, :cover_dark] do
    {:ok, :pass}
  end

  defp replacement_body_bag_required(_ref, attrs) do
    if is_nil(value(attrs, :body_bag)) do
      {:error, :replace_asset_use_body_bag_required}
    else
      {:ok, :pass}
    end
  end

  defp ref_input(ref, replaced_id, target_asset_id) do
    ref
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
    |> Map.put(:asset_id, if(ref.id == replaced_id, do: target_asset_id, else: ref.asset_id))
  end

  defp locate_ref(%ArticleDraft{body_draft_id: body_draft_id}, attrs) do
    refs =
      body_draft_id
      |> Writer.lock_draft_refs(usage(attrs))
      |> Enum.filter(&locator_match?(&1, attrs))

    case refs do
      [ref] -> {:ok, ref}
      [] -> {:error, :asset_use_not_found}
      _ -> {:error, :asset_use_locator_ambiguous}
    end
  end

  defp locate_ref(_draft, _attrs), do: {:error, :doc_asset_replace_requires_branch_context}

  defp locator_match?(ref, attrs) do
    matches?(attrs, :block_id, ref.block_id) and matches?(attrs, :position, ref.position)
  end

  defp matches?(attrs, key, actual) do
    case Map.fetch(attrs, key) do
      :error -> true
      {:ok, expected} -> expected == actual
    end
  end

  defp same_asset(%ArticleAssetRef{asset_id: asset_id}, asset_id), do: {:ok, :pass}
  defp same_asset(_, _), do: {:error, :asset_use_source_conflict}

  defp active_asset(community_id, asset_id) when is_binary(asset_id) or is_integer(asset_id) do
    case Query.active_asset(community_id, asset_id) do
      {:ok, %CommunityAsset{} = asset} -> {:ok, asset}
      {:error, _reason} -> {:error, :replacement_asset_not_active}
    end
  end

  defp active_asset(_community_id, _asset_id), do: {:error, :replacement_asset_required}

  defp expected_version(attrs, version) do
    case value(attrs, :expected_draft_version) do
      ^version -> {:ok, :pass}
      nil -> {:error, :expected_draft_version_required}
      _ -> {:error, :draft_version_conflict}
    end
  end

  defp present_confirmation(%Confirmation{data: data}) do
    with article_id when is_binary(article_id) <- data["article_id"],
         draft_version when is_integer(draft_version) <- data["draft_version"],
         command_id when is_binary(command_id) <- data["command_id"] do
      {:ok, %{article_id: article_id, draft_version: draft_version, command_id: command_id}}
    else
      _ -> {:error, ErrorCat.command_result_unavailable()}
    end
  end

  defp load_article(%Article{} = article), do: FrontDesk.article(article.id, mode: :internal)

  defp load_article(%{article_id: article_id}) when is_binary(article_id) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _reason} -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
    end
  end

  defp load_article(_), do: {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}

  defp binding_context(article, %{community: %Community{} = community}) do
    Bindings.get(article, community)
  end

  defp binding_context(article, _article_or_projection),
    do: Bindings.get(article, Map.get(article, :community))

  defp usage(attrs) do
    case value(attrs, :usage) do
      usage when usage in [:inline, :cover, :cover_dark, :attachment, :embed] -> usage
      usage when is_binary(usage) -> String.to_existing_atom(usage)
      _ -> :inline
    end
  rescue
    ArgumentError -> :inline
  end

  defp value(attrs, key), do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))
end
