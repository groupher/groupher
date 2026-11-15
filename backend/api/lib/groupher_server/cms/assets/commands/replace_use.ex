defmodule GroupherServer.CMS.Assets.Commands.ReplaceUse do
  @moduledoc """
  Replaces one asset locator in the default Article WorkingCopy.

  The command validates the observed WorkingCopy revision and the old asset reference,
  then updates the WorkingCopy and its WorkingCopy-owned `ArticleAssetRef` rows in the same
  command transaction. Revision-owned refs are never selected by this module.

      CMS.Assets facade
        -> ReplaceUse command
        -> Gate-authorized WorkingCopy update
        -> ArticleAssetRef synchronization
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.{Bindings, WorkingCopy.Store}
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Assets.{Query, Refs}
  alias CMS.{ErrorCat, FrontDesk}
  alias CMS.Model.{Article, ArticleAssetRef, ArticleWorkingCopy, Community, CommunityAsset}
  alias CMS.Assets.Commands.ReplaceUseConfirmation, as: Confirmation

  @doc "Replaces one Draft-owned asset use without mutating an immutable Revision.

  User retries use a UUID command identity and the Receipt path. ReplacementPlan
  applies use a stable `{:workflow, step_ref}` identity; it never manufactures a
  user command id for a locator."
  @spec execute(
          map() | Article.t(),
          map(),
          User.t(),
          Ecto.UUID.t()
        ) ::
          {:ok, map()} | {:error, term()}
  def execute(article_or_projection, attrs, %User{} = user, command_id) when is_map(attrs) do
    with {:ok, article} <- load_article(article_or_projection),
         {:ok, %{community: %Community{} = community}} <-
           binding_context(article, article_or_projection) do
      params = Map.drop(attrs, [:command_id, :cur_user, :step_ref])

      execute_receipt(article, community, params, user, command_id)
    else
      {:error, _reason} = error -> error
    end
  end

  @doc false
  def execute_for_workflow(article_or_projection, attrs, %User{} = user, workflow_ref)
      when is_map(attrs) and is_binary(workflow_ref) and workflow_ref != "" do
    with {:ok, article} <- load_article(article_or_projection),
         {:ok, %{community: %Community{} = community}} <-
           binding_context(article, article_or_projection) do
      params = Map.drop(attrs, [:command_id, :cur_user, :step_ref])
      execute_workflow(article, community, params, user, workflow_ref)
    end
  end

  defp replace_with_workflow_recovery(article, community, params, user, workflow_ref) do
    case recover_existing_replacement(article, params, workflow_ref) do
      {:ok, result} ->
        {:ok, result}

      :not_applied ->
        with {:ok, result} <- replace_loaded(article, community, params, user) do
          {:ok, Map.put(result, :workflow_ref, workflow_ref)}
        end
    end
  end

  defp recover_existing_replacement(article, params, workflow_ref) do
    with {:ok, %ArticleWorkingCopy{} = work} <- target_working_copy(article, params),
         {:ok, :pass} <- WorkingCopyAccess.generic_save(article, work),
         revision when is_integer(revision) <- value(params, :revision),
         true <- work.revision == revision + 1,
         refs <- Refs.working_copy_refs(work.id),
         %ArticleAssetRef{} = ref <- Enum.find(refs, &same_locator?(&1, params)),
         true <- ref.asset_id == value(params, :to_asset_id) do
      {:ok,
       %{
         article_id: article.id,
         working_copy_id: work.id,
         revision: work.revision,
         ref_id: ref.id,
         usage: ref.usage,
         from_asset_id: value(params, :from_asset_id),
         to_asset_id: ref.asset_id,
         workflow_ref: workflow_ref
       }}
    else
      _ -> :not_applied
    end
  end

  defp same_locator?(ref, params) do
    ref.usage == value(params, :usage) and
      locator_matches?(params, :block_id, ref.block_id) and
      locator_matches?(params, :position, ref.position)
  end

  defp locator_matches?(params, key, actual) do
    case Map.fetch(params, key) do
      :error -> true
      {:ok, expected} -> expected == actual
    end
  end

  @pipeline operation: :article_replace_asset,
            confirmation: Confirmation,
            target: :article,
            params: :params

  receipt_pipeline execute_receipt(article, community, params, user, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_in_transaction(user, edit_action(candidate), candidate, community)
    end)

    change(fn canonical ->
      replace_loaded(canonical, community, params, user)
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data:
           result
           |> Map.take([
             :article_id,
             :working_copy_id,
             :revision,
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
    end)

    present(fn confirmation -> present_confirmation(confirmation, article, community, user) end)
  end

  @pipeline operation: :article_replace_asset_workflow,
            target: :article,
            params: :params
  direct_pipeline execute_workflow(article, community, params, user, workflow_ref) do
    gate(fn candidate ->
      with {:ok, canonical} <- CMS.Gate.check_in_transaction(user, :edit, candidate, community) do
        case recover_existing_replacement(canonical, params, workflow_ref) do
          {:ok, _result} ->
            {:ok, canonical}

          :not_applied ->
            CMS.Gate.check_in_transaction(user, :edit_article, canonical, community)
        end
      end
    end)

    change(fn canonical ->
      replace_with_workflow_recovery(canonical, community, params, user, workflow_ref)
    end)
  end

  defp edit_action(%Article{thread: thread}) when thread in [:post, :blog, :changelog] do
    :edit_article
  end

  defp edit_action(%Article{}), do: :edit

  defp replace_loaded(canonical, community, attrs, user) do
    with {:ok, %ArticleWorkingCopy{} = work} <- target_working_copy(canonical, attrs),
         {:ok, :pass} <- WorkingCopyAccess.generic_save(canonical, work),
         {:ok, :pass} <- expected_revision(attrs, work.revision),
         {:ok, ref} <- locate_ref(work, attrs),
         {:ok, target_asset} <- active_asset(community.id, value(attrs, :to_asset_id)),
         {:ok, _} <- same_asset(ref, value(attrs, :from_asset_id)),
         {:ok, _} <- replacement_body_bag_required(ref, attrs),
         save_attrs <- replacement_attrs(work, ref, target_asset, attrs),
         {:ok, updated_work} <-
           Store.save_loaded(work, save_attrs, user, work.revision, community.id) do
      {:ok,
       %{
         article_id: canonical.id,
         working_copy_id: work.id,
         revision: updated_work.revision,
         ref_id: ref.id,
         usage: ref.usage,
         from_asset_id: ref.asset_id,
         to_asset_id: target_asset.id
       }}
    end
  end

  defp replacement_attrs(work, ref, target_asset, attrs) do
    case ref.usage do
      :cover ->
        %{cover_asset_id: target_asset.id}

      :cover_dark ->
        %{cover_asset_dark_id: target_asset.id}

      :attachment ->
        refs =
          Refs.working_copy_refs(work.id)
          |> Enum.filter(&(&1.usage == :attachment))

        %{asset_refs: Enum.map(refs, &ref_input(&1, ref.id, target_asset.id))}

      _ ->
        %{body_bag: value(attrs, :body_bag)}
    end
  end

  defp replacement_body_bag_required(%ArticleAssetRef{usage: usage}, _attrs)
       when usage in [:cover, :cover_dark, :attachment] do
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

  defp locate_ref(%ArticleWorkingCopy{id: working_copy_id}, attrs) do
    refs =
      working_copy_id
      |> lock_working_copy_refs(usage(attrs))
      |> Enum.filter(&locator_match?(&1, attrs))

    case refs do
      [ref] -> {:ok, ref}
      [] -> {:error, :asset_use_not_found}
      _ -> {:error, :asset_use_locator_ambiguous}
    end
  end

  defp default_working_copy(%Article{id: article_id}) do
    case Repo.get_by(ArticleWorkingCopy,
           article_id: article_id,
           scope_type: :default,
           scope_id: article_id
         ) do
      %ArticleWorkingCopy{} = work -> {:ok, work}
      nil -> {:error, :working_copy_not_found}
    end
  end

  defp target_working_copy(%Article{id: article_id} = article, attrs) do
    case value(attrs, :working_copy_id) do
      nil ->
        default_working_copy(article)

      id when is_binary(id) ->
        case Repo.get_by(ArticleWorkingCopy, id: id, article_id: article_id) do
          %ArticleWorkingCopy{} = work -> {:ok, work}
          nil -> {:error, :working_copy_not_found}
        end

      _ ->
        {:error, :working_copy_not_found}
    end
  end

  defp lock_working_copy_refs(working_copy_id, usage) do
    import Ecto.Query

    ArticleAssetRef
    |> where([ref], ref.working_copy_id == ^working_copy_id and ref.usage == ^usage)
    |> order_by([ref], asc: ref.position, asc: ref.inserted_at, asc: ref.id)
    |> lock("FOR UPDATE")
    |> Repo.all()
  end

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

  defp expected_revision(attrs, revision) do
    case value(attrs, :revision) do
      ^revision -> {:ok, :pass}
      nil -> {:error, :revision_required}
      _ -> {:error, :revision_conflict}
    end
  end

  defp present_confirmation(%Confirmation{data: data}, article, community, actor) do
    with article_id when is_binary(article_id) <- data["article_id"],
         true <- article.id == article_id,
         {:ok, _} <- WorkingCopyAccess.access_check(actor, :edit, article, community),
         revision when is_integer(revision) <- data["revision"],
         working_copy_id when is_binary(working_copy_id) <- data["working_copy_id"],
         %ArticleWorkingCopy{article_id: ^article_id} <-
           Repo.get(ArticleWorkingCopy, working_copy_id),
         command_id when is_binary(command_id) <- data["command_id"] do
      {:ok,
       %{
         article_id: article_id,
         working_copy_id: working_copy_id,
         revision: revision,
         command_id: command_id
       }}
    else
      {:error, _reason} -> {:error, ErrorCat.command_result_unavailable()}
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

  defp binding_context(article, _article_or_projection) do
    Bindings.get(article, Map.get(article, :community))
  end

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
