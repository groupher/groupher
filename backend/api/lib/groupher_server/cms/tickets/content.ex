defmodule GroupherServer.CMS.Tickets.Content do
  @moduledoc """
  Adapts the shared Article WorkingCopy and Snapshot content store for Ticket commands.

  Ticket commands own authorization, Ticket Lifecycle, source and preview-anchor
  checks. This module persists only the Ticket's generic Article content; it does
  not invoke ordinary Article publication orchestration, stats, tags or feed effects.

      Ticket Command -> Tickets.Content -> Article WorkingCopy / Snapshot / Public
                                      `-> ArticleAssetRef owner rows
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.{Deleter, Snapshotter, Store}

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    Author,
    Community
  }

  @doc "Creates a Ticket Article and its default WorkingCopy in the caller transaction."
  def create_workspace(%Community{} = community, attrs, %Author{} = author, _opts \\ []) do
    with {:ok, user} <- user_for_author(author),
         {:ok, article} <-
           CMS.Articles.Identity.create_loaded(
             community,
             :ticket,
             attrs,
             author
           ),
         work_attrs <- Map.merge(attrs, %{scope_type: :default, scope_id: article.id}),
         {:ok, working_copy} <- Store.create_loaded(article, work_attrs, user, community.id) do
      {:ok, %{article: article, working_copy: working_copy}}
    end
  end

  @doc "Copies the selected Post Snapshot's asset references to a new Ticket WorkingCopy."
  def clone_snapshot_refs(
        %Article{thread: source_thread, id: source_id},
        %ArticleSnapshot{id: snapshot_id, article_id: source_id},
        %Article{thread: :ticket, id: target_article_id},
        %ArticleWorkingCopy{id: target_id}
      )
      when source_thread in [:post, :ticket] do
    with %ArticlePublic{snapshot_id: ^snapshot_id} <- Repo.get(ArticlePublic, source_id),
         {:ok, community_id} <- shared_community(source_id, target_article_id, :working_copy_id) do
      copy_owner_refs(:snapshot_id, snapshot_id, :working_copy_id, target_id, community_id)
    else
      nil -> {:error, :source_snapshot_not_public}
      {:error, _reason} = error -> error
      _ -> {:error, :invalid_ticket_asset_clone}
    end
  end

  def clone_snapshot_refs(_source, _snapshot, _target, _working_copy) do
    {:error, :invalid_ticket_asset_clone}
  end

  @doc "Copies same-Community Ticket WorkingCopy asset references to a new Ticket."
  def clone_working_copy_refs(
        %Article{thread: :ticket, id: source_id},
        %ArticleWorkingCopy{article_id: source_id, id: source_work_id},
        %Article{thread: :ticket} = target,
        %ArticleWorkingCopy{id: target_work_id}
      ) do
    with {:ok, community_id} <- shared_community(source_id, target.id, :working_copy_id) do
      copy_owner_refs(
        :working_copy_id,
        source_work_id,
        :working_copy_id,
        target_work_id,
        community_id
      )
    end
  end

  def clone_working_copy_refs(_source, _source_working_copy, _target, _target_working_copy) do
    {:error, :invalid_ticket_asset_clone}
  end

  @doc "Loads the current Ticket WorkingCopy or independently clones the selected Snapshot."
  def ensure_workspace(%Article{thread: :ticket} = article, %Author{} = author, opts) do
    case get_workspace(article) do
      {:ok, working_copy} ->
        {:ok, working_copy}

      {:error, :not_found} ->
        with %ArticleLifecycle{state: :published, version: version} <-
               Repo.get_by(ArticleLifecycle, article_id: article.id),
             true <- version == Keyword.fetch!(opts, :expected_lifecycle_version),
             {:ok, snapshot} <- get_public_snapshot(article),
             {:ok, user} <- user_for_author(author),
             {:ok, working_copy} <-
               Snapshotter.fork_snapshot_in_transaction(
                 snapshot.id,
                 %{article_id: article.id, scope_type: :default, scope_id: article.id},
                 user
               ) do
          {:ok, working_copy}
        else
          false -> {:error, :lifecycle_version_conflict}
          nil -> {:error, :article_lifecycle_not_found}
          {:error, _reason} = error -> error
          _ -> {:error, :article_lifecycle_not_found}
        end
    end
  end

  def ensure_workspace(%Article{}, %Author{}, _opts), do: {:error, :invalid_ticket_identity}

  @doc "Returns the default Ticket WorkingCopy without creating one."
  def get_workspace(%Article{thread: :ticket, id: article_id}) do
    case Repo.get_by(ArticleWorkingCopy,
           article_id: article_id,
           scope_type: :default,
           scope_id: article_id
         ) do
      %ArticleWorkingCopy{} = working_copy -> {:ok, working_copy}
      nil -> {:error, :not_found}
    end
  end

  def get_workspace(%Article{}), do: {:error, :invalid_ticket_identity}

  @doc "Returns the immutable Snapshot currently selected for a Ticket."
  def get_public_snapshot(%Article{thread: :ticket, id: article_id}) do
    case Repo.get(ArticlePublic, article_id) do
      %ArticlePublic{snapshot_id: snapshot_id} when is_binary(snapshot_id) ->
        case Repo.get_by(ArticleSnapshot, id: snapshot_id, article_id: article_id) do
          %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
          nil -> {:error, :public_not_found}
        end

      _ ->
        {:error, :public_not_found}
    end
  end

  def get_public_snapshot(%Article{}), do: {:error, :invalid_ticket_identity}

  @doc "Saves an existing Ticket WorkingCopy after checking its Ticket Lifecycle version."
  def save_workspace(%Article{thread: :ticket} = article, attrs, %Author{} = author, opts) do
    with %ArticleLifecycle{version: version} <-
           Repo.get_by(ArticleLifecycle, article_id: article.id),
         true <- version == Keyword.fetch!(opts, :expected_lifecycle_version),
         %ArticleWorkingCopy{} = working_copy <-
           Repo.get_by(ArticleWorkingCopy,
             article_id: article.id,
             scope_type: :default,
             scope_id: article.id
           ),
         {:ok, user} <- user_for_author(author),
         {:ok, community_id} <- ticket_community_id(article.id),
         {:ok, saved} <-
           Store.save_loaded(
             working_copy,
             attrs,
             user,
             Keyword.fetch!(opts, :revision),
             community_id
           ) do
      {:ok, saved}
    else
      false -> {:error, :lifecycle_version_conflict}
      nil -> {:error, :article_lifecycle_not_found}
      {:error, _reason} = error -> error
    end
  end

  def save_workspace(%Article{}, _attrs, %Author{}, _opts) do
    {:error, :invalid_ticket_identity}
  end

  @doc "Freezes a Ticket WorkingCopy for the Ticket-specific publish transition."
  def freeze_working_copy(
        %Article{thread: :ticket, id: article_id} = article,
        %ArticleWorkingCopy{article_id: article_id} = working_copy,
        %User{} = actor,
        command_id
      ) do
    Snapshotter.freeze_locked(article, working_copy, actor, command_id)
  end

  def freeze_working_copy(_article, _working_copy, _actor, _command_id) do
    {:error, :invalid_ticket_working_copy}
  end

  @doc "Selects a same-Article Snapshot without ordinary Article publish side effects."
  def select_public(article, snapshot, actor, opts \\ [])

  def select_public(
        %Article{thread: :ticket} = article,
        %ArticleSnapshot{} = snapshot,
        %User{} = actor,
        opts
      ) do
    if snapshot.article_id == article.id do
      CMS.Articles.Public.select_snapshot(article, snapshot, actor, opts)
    else
      {:error, :snapshot_owner_mismatch}
    end
  end

  def select_public(%Article{}, %ArticleSnapshot{}, %User{}, _opts) do
    {:error, :invalid_ticket_identity}
  end

  @doc "Deletes only the mutable Ticket WorkingCopy after its Snapshot is selected."
  def delete_workspace(%Article{thread: :ticket} = article, %ArticleWorkingCopy{} = working_copy) do
    case Deleter.delete_in_transaction(article, working_copy) do
      {:ok, :deleted} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  def delete_workspace(%Article{}, _working_copy), do: {:error, :invalid_ticket_working_copy}

  @doc "Returns shared content fields for internal Ticket projections."
  def working_copy_content(%Article{thread: :ticket} = article) do
    with {:ok, %ArticleWorkingCopy{} = working_copy} <- get_workspace(article) do
      {:ok,
       %{
         body: working_copy,
         digest: working_copy.digest,
         title: working_copy.title,
         revision: working_copy.revision
       }}
    end
  end

  def working_copy_content(%Article{}), do: {:error, :invalid_ticket_identity}

  defp shared_community(source_id, target_id, target_owner) do
    shared_community_id =
      Repo.one(
        from(source in ArticleBinding,
          join: target in ArticleBinding,
          on: target.community_id == source.community_id,
          where: source.article_id == ^source_id and target.article_id == ^target_id,
          select: source.community_id,
          limit: 1
        )
      )

    case shared_community_id do
      community_id when is_integer(community_id) ->
        {:ok, community_id}

      nil ->
        cond do
          not Repo.exists?(
            from(binding in ArticleBinding, where: binding.article_id == ^source_id)
          ) ->
            {:error, :source_binding_not_found}

          not Repo.exists?(
            from(binding in ArticleBinding, where: binding.article_id == ^target_id)
          ) ->
            {:error, :target_binding_not_found}

          true ->
            {:error, {:community_mismatch, target_owner}}
        end
    end
  end

  defp copy_owner_refs(source_field, source_id, target_field, target_id, community_id) do
    if Repo.in_transaction?() do
      Repo.delete_all(
        from(ref in ArticleAssetRef,
          where: field(ref, ^target_field) == ^target_id
        )
      )

      refs =
        Repo.all(
          from(ref in ArticleAssetRef,
            where: field(ref, ^source_field) == ^source_id,
            order_by: [asc: ref.position, asc: ref.inserted_at, asc: ref.id]
          )
        )

      Enum.reduce_while(refs, {:ok, :pass}, fn ref, {:ok, _} ->
        attrs =
          ref
          |> Map.from_struct()
          |> Map.take(~w(asset_id usage block_id block_type position title alt source meta)a)
          |> Map.put(:community_id, community_id)
          |> Map.put(target_field, target_id)

        case %ArticleAssetRef{} |> ArticleAssetRef.changeset(attrs) |> Repo.insert() do
          {:ok, _ref} -> {:cont, {:ok, :pass}}
          {:error, _changeset} = error -> {:halt, error}
        end
      end)
    else
      {:error, :transaction_required}
    end
  end

  defp ticket_community_id(article_id) do
    case Repo.get_by(ArticleBinding, article_id: article_id) do
      %ArticleBinding{community_id: community_id} -> {:ok, community_id}
      nil -> {:error, :ticket_binding_not_found}
    end
  end

  defp user_for_author(%Author{user_id: user_id}) do
    case Repo.get(User, user_id) do
      %User{} = user -> {:ok, user}
      nil -> {:error, :ticket_actor_not_found}
    end
  end
end
