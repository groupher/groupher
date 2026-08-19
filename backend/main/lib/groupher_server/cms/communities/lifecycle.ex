defmodule GroupherServer.CMS.Communities.Lifecycle do
  @moduledoc """
  State, blocker and capability authority for Community availability.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Lifecycle
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Const
  alias GroupherServer.CMS.Model.{Community, CommunityLifecycle, CommunityLifecycleBlocker}
  alias GroupherServer.CMS.Gate.ErrorCat, as: GateErrorCat
  alias GroupherServer.CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias Helper.Constant

  require Const

  @archive_blockers [:owner_archive, :moderation_archive]
  @hidden_blockers [:moderation_suspend, :moderation_archive, :owner_archive]
  @write_blockers [
    :moderation_suspend,
    :moderation_archive,
    :owner_archive
  ]
  @destroy_blockers [:moderation_suspend, :moderation_archive, :ops_legal_hold]
  @recoverable_archive_blockers [:owner_archive, :moderation_archive]
  @public_readable_states [:active, :read_only]
  @management_readable_states [
    :setting_up,
    :setup_failed,
    :active,
    :read_only,
    :suspended,
    :archived,
    :pending_destroy
  ]
  @operations_readable_states [
    :setting_up,
    :setup_failed,
    :active,
    :read_only,
    :suspended,
    :archived,
    :pending_destroy,
    :destroy
  ]
  @uuid_pattern ~r/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i
  @allowed_transitions %{
    setting_up: [:active, :setup_failed],
    setup_failed: [:setting_up, :archived],
    active: [:active, :read_only, :suspended, :archived, :pending_destroy],
    read_only: [:active, :read_only, :suspended, :archived, :pending_destroy],
    suspended: [:active, :read_only, :suspended, :archived, :pending_destroy],
    archived: [:active, :read_only, :suspended, :archived, :pending_destroy],
    pending_destroy: [:active, :read_only, :suspended, :archived, :pending_destroy, :destroy],
    destroy: [:destroy]
  }

  @type capability :: :read | :write | :manage | :destroy
  @type read_mode :: :public | :owner_management | :moderator_management | :operations

  @doc "Returns the read modes shared by Community Scope and access checks."
  @spec read_modes() :: [read_mode()]
  def read_modes, do: [:public, :owner_management, :moderator_management, :operations]

  @doc """
  Returns the Lifecycle states readable by a Community policy mode.

  `pending_destroy` is the materialized grace-window state. Its inclusion in
  management and operations modes assumes Lifecycle orchestration advances
  that state to `destroy` after the window; this function is a state predicate,
  not a wall-clock deadline check.
  """
  @spec readable_states(read_mode()) :: [atom()]
  def readable_states(:public), do: @public_readable_states
  def readable_states(:owner_management), do: @management_readable_states
  def readable_states(:moderator_management), do: @management_readable_states
  def readable_states(:operations), do: @operations_readable_states

  @doc "Checks a Community Lifecycle state for an explicit read policy mode."
  @spec can_read_mode(Community.t() | CommunityLifecycle.t(), read_mode(), map()) ::
          {:ok, boolean()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def can_read_mode(resource, mode, _context)
      when mode in [:public, :owner_management, :moderator_management, :operations] do
    with {:ok, lifecycle} <- lifecycle_from(resource) do
      {:ok, lifecycle.state in readable_states(mode)}
    end
  end

  def can_read_mode(_resource, _mode, _context), do: {:error, GateErrorCat.unknown_policy_mode()}

  @doc "Projects active blockers into the materialized Lifecycle state."
  @spec resolve_state([CommunityLifecycleBlocker.t() | map()]) :: atom()
  def resolve_state(blockers) when is_list(blockers) do
    types = Enum.map(blockers, &blocker_type/1)

    cond do
      Enum.any?(types, &(&1 in @archive_blockers)) -> Const.lifecycle_state(:archived)
      Enum.any?(types, &(&1 in @hidden_blockers)) -> Const.lifecycle_state(:suspended)
      Enum.any?(types, &(&1 in @write_blockers)) -> Const.lifecycle_state(:read_only)
      true -> Const.lifecycle_state(:active)
    end
  end

  @doc "Answers a state-only capability without interpreting actor identity."
  @spec can_read(Community.t() | CommunityLifecycle.t(), map()) ::
          {:ok, boolean()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def can_read(resource, context \\ %{}), do: capability(resource, :read, context)

  @spec can_write(Community.t() | CommunityLifecycle.t(), map()) ::
          {:ok, boolean()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def can_write(resource, context \\ %{}), do: capability(resource, :write, context)

  @spec can_manage(Community.t() | CommunityLifecycle.t(), map()) ::
          {:ok, boolean()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def can_manage(resource, context \\ %{}), do: capability(resource, :manage, context)

  @spec can_destroy(Community.t() | CommunityLifecycle.t(), map()) ::
          {:ok, boolean()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def can_destroy(resource, context \\ %{}), do: capability(resource, :destroy, context)

  @doc "Creates a Lifecycle changeset for a guarded state transition."
  @spec transition_changeset(CommunityLifecycle.t(), atom(), map()) :: Ecto.Changeset.t()
  def transition_changeset(%CommunityLifecycle{} = lifecycle, state, attrs \\ %{}) do
    CommunityLifecycle.changeset(lifecycle, Map.merge(attrs, transition_attrs(lifecycle, state)))
  end

  @doc "Creates the initial setting_up Lifecycle row for a newly created Community."
  @spec initial_changeset(map()) :: Ecto.Changeset.t()
  def initial_changeset(attrs) when is_map(attrs) do
    %CommunityLifecycle{}
    |> CommunityLifecycle.changeset(
      Map.merge(
        %{
          state: Const.lifecycle_state(:setting_up),
          version: 1,
          changed_at: DateTime.utc_now(:second)
        },
        attrs
      )
    )
  end

  @doc "Creates the active Lifecycle row for a legacy/global Community creation path."
  @spec ensure_created(integer(), keyword()) ::
          {:ok, CommunityLifecycle.t()} | {:error, Ecto.Changeset.t()}
  def ensure_created(community_id, opts \\ []) when is_integer(community_id) do
    case Repo.get_by(CommunityLifecycle, community_id: community_id) do
      %CommunityLifecycle{} = lifecycle ->
        {:ok, lifecycle}

      nil ->
        attrs =
          opts
          |> Keyword.get(:attrs, %{})
          |> Map.merge(%{
            community_id: community_id,
            state: Keyword.get(opts, :state, :active),
            version: 1,
            changed_at: DateTime.utc_now(:second)
          })

        %CommunityLifecycle{}
        |> CommunityLifecycle.changeset(attrs)
        |> Repo.insert()
    end
  end

  @doc "Adds a guarded state update to an existing Ecto.Multi transaction."
  @spec update_multi(Multi.t(), atom(), CommunityLifecycle.t(), atom(), map()) :: Multi.t()
  def update_multi(multi, key, %CommunityLifecycle{} = lifecycle, state, attrs \\ %{}) do
    Multi.update(multi, key, transition_changeset(lifecycle, state, attrs))
  end

  @doc "Locks one Lifecycle row, applies a state transition and recomputes blockers when requested."
  @spec transition(String.t() | integer(), atom(), keyword()) ::
          {:ok, CommunityLifecycle.t()} | {:error, term()}
  def transition(community_ref, state, opts \\ []) when is_atom(state) do
    Repo.transaction(fn ->
      lifecycle = lock_for_transition(community_ref)

      if is_nil(lifecycle) do
        Repo.rollback(CommunityErrorCat.lifecycle_not_found())
      else
        expected_version = Keyword.get(opts, :expected_version)

        if expected_version && lifecycle.version != expected_version do
          Repo.rollback(CommunityErrorCat.lifecycle_state_conflict())
        else
          if state != :__reconcile__ and not allowed_transition?(lifecycle.state, state) do
            Repo.rollback(CommunityErrorCat.lifecycle_state_conflict())
          else
            attrs = Keyword.get(opts, :attrs, %{})

            operation_ref =
              if state == :__reconcile__ do
                nil
              else
                resolve_operation_ref!(Keyword.get(opts, :operation_ref))
              end

            case update_lifecycle(lifecycle, state, attrs) do
              {:ok, updated} ->
                if state == :__reconcile__ do
                  updated
                else
                  audit_action = Keyword.get(opts, :audit_action)

                  if is_binary(audit_action) do
                    case write_audit(
                           updated,
                           operation_ref,
                           audit_action,
                           %{from_state: lifecycle.state, to_state: updated.state}
                         ) do
                      {:ok, _audit} -> updated
                      {:error, reason} -> Repo.rollback(reason)
                    end
                  else
                    Repo.rollback(CommunityErrorCat.missing_lifecycle_audit_action())
                  end
                end

              {:error, reason} ->
                Repo.rollback(reason)
            end
          end
        end
      end
    end)
  end

  @doc "Creates or returns the active blocker for one source and recomputes state atomically."
  @spec apply_blocker(String.t() | integer(), map(), keyword()) ::
          {:ok, CommunityLifecycleBlocker.t()} | {:error, term()}
  def apply_blocker(community_ref, attrs, opts \\ []) when is_map(attrs) do
    Repo.transaction(fn ->
      operation_ref = resolve_operation_ref!(Keyword.get(opts, :operation_ref))
      opts = Keyword.put(opts, :operation_ref, operation_ref)
      lifecycle = lock_for_transition_or_bootstrap(community_ref, opts)

      if is_nil(lifecycle) do
        Repo.rollback(CommunityErrorCat.lifecycle_not_found())
      else
        ensure_not_destroyed!(lifecycle)
        ensure_expected_version!(lifecycle, opts)
        ensure_state_allowed!(lifecycle, Keyword.get(opts, :allowed_states))

        attrs =
          Map.merge(%{lifecycle_id: lifecycle.id, community_id: lifecycle.community_id}, attrs)

        case active_blocker(attrs) do
          %CommunityLifecycleBlocker{} = blocker ->
            blocker

          nil ->
            with {:ok, blocker} <- insert_blocker(attrs, opts),
                 {:ok, _lifecycle} <-
                   recompute_locked(
                     lifecycle,
                     opts,
                     "community.blocker_created",
                     %{blocker_type: blocker.blocker_type, cause_ref: blocker.cause_ref}
                   ) do
              blocker
            else
              {:error, reason} -> Repo.rollback(reason)
            end
        end
      end
    end)
  end

  @doc "Releases one active blocker owned by its source and recomputes state atomically."
  @spec release_blocker(String.t() | integer(), atom(), String.t() | nil, keyword()) ::
          {:ok, CommunityLifecycleBlocker.t()} | {:error, term()}
  def release_blocker(community_ref, type, cause_ref \\ nil, opts \\ []) do
    Repo.transaction(fn ->
      operation_ref = resolve_operation_ref!(Keyword.get(opts, :operation_ref))
      opts = Keyword.put(opts, :operation_ref, operation_ref)
      lifecycle = lock_for_transition(community_ref)

      if is_nil(lifecycle) do
        Repo.rollback(CommunityErrorCat.lifecycle_not_found())
      else
        ensure_not_destroyed!(lifecycle)
        ensure_expected_version!(lifecycle, opts)

        blocker =
          CommunityLifecycleBlocker
          |> where(
            [blocker],
            blocker.lifecycle_id == ^lifecycle.id and blocker.blocker_type == ^type and
              is_nil(blocker.ended_at)
          )
          |> maybe_cause_ref(cause_ref)
          |> Repo.one()

        if is_nil(blocker) do
          Repo.rollback(CommunityErrorCat.blocker_not_found())
        else
          if Keyword.get(opts, :check_recover_until, false) and
               not recovery_window_active?(blocker, DateTime.utc_now(:second)) do
            Repo.rollback(CommunityErrorCat.archive_recovery_window_expired())
          end

          now = DateTime.utc_now(:second)

          with {:ok, blocker} <-
                 blocker
                 |> CommunityLifecycleBlocker.changeset(%{
                   ended_at: now,
                   end_type:
                     Keyword.get(opts, :end_type, Const.lifecycle_blocker_end_type(:released)),
                   ended_by_operation_ref: operation_ref
                 })
                 |> Repo.update(),
               {:ok, _lifecycle} <-
                 recompute_locked(
                   lifecycle,
                   opts,
                   "community.blocker_released",
                   %{blocker_type: blocker.blocker_type, cause_ref: blocker.cause_ref}
                 ) do
            blocker
          else
            {:error, reason} -> Repo.rollback(reason)
          end
        end
      end
    end)
  end

  @doc "Creates the owner's destroy-request blocker and projects the Community to archived."
  @spec request_destroy(String.t() | integer(), keyword()) ::
          {:ok, CommunityLifecycleBlocker.t()} | {:error, term()}
  def request_destroy(community_ref, opts \\ []) do
    attrs = %{
      blocker_type: :owner_archive,
      cause_code: Keyword.get(opts, :cause_code, "owner_archive"),
      recover_until: Keyword.get(opts, :recover_until)
    }

    apply_blocker(
      community_ref,
      attrs,
      opts
      |> Keyword.put(:allowed_states, [:active, :read_only, :suspended, :archived])
      |> Keyword.put(:bootstrap_missing, true)
    )
  end

  @doc "Releases only the owner's archive blocker while its recovery window is open."
  @spec restore(String.t() | integer(), keyword()) ::
          {:ok, CommunityLifecycleBlocker.t()} | {:error, term()}
  def restore(community_ref, opts \\ []) do
    release_blocker(
      community_ref,
      :owner_archive,
      nil,
      Keyword.put(opts, :check_recover_until, true)
    )
  end

  @doc "Schedules a locked, auditable Community destroy after all guards pass."
  @spec schedule_destroy(String.t() | integer(), keyword()) ::
          {:ok, CommunityLifecycle.t()} | {:error, term()}
  def schedule_destroy(community_ref, opts \\ []) do
    Repo.transaction(fn ->
      operation_ref = resolve_operation_ref!(Keyword.get(opts, :operation_ref))
      lifecycle = lock_for_transition(community_ref)
      ensure_lifecycle!(lifecycle)
      ensure_expected_version!(lifecycle, opts)

      unless lifecycle.state == :archived do
        Repo.rollback(CommunityErrorCat.lifecycle_state_conflict())
      end

      blockers = active_blockers(lifecycle.id)
      ensure_destroy_allowed!(blockers, DateTime.utc_now(:second))

      case Repo.update(transition_changeset(lifecycle, :pending_destroy)) do
        {:ok, updated} ->
          case write_audit(
                 updated,
                 operation_ref,
                 "community.destroy_scheduled",
                 %{from_state: lifecycle.state, to_state: updated.state}
               ) do
            {:ok, _audit} -> updated
            {:error, reason} -> Repo.rollback(reason)
          end

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  @doc "Cancels a scheduled destroy and recomputes state from active blockers."
  @spec cancel_destroy(String.t() | integer(), keyword()) ::
          {:ok, CommunityLifecycle.t()} | {:error, term()}
  def cancel_destroy(community_ref, opts \\ []) do
    Repo.transaction(fn ->
      operation_ref = resolve_operation_ref!(Keyword.get(opts, :operation_ref))
      lifecycle = lock_for_transition(community_ref)
      ensure_lifecycle!(lifecycle)
      ensure_expected_version!(lifecycle, opts)

      unless lifecycle.state == :pending_destroy do
        Repo.rollback(CommunityErrorCat.lifecycle_state_conflict())
      end

      state = resolve_state(active_blockers(lifecycle.id))

      case Repo.update(transition_changeset(lifecycle, state)) do
        {:ok, updated} ->
          case write_audit(
                 updated,
                 operation_ref,
                 "community.destroy_cancelled",
                 %{from_state: lifecycle.state, to_state: updated.state}
               ) do
            {:ok, _audit} -> updated
            {:error, reason} -> Repo.rollback(reason)
          end

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  @doc "Terminates active blockers and records the Community destroy transition atomically."
  @spec destroy(String.t() | integer(), keyword()) ::
          {:ok, CommunityLifecycle.t()} | {:error, term()}
  def destroy(community_ref, opts \\ []) do
    Repo.transaction(fn ->
      lifecycle = lock_for_transition(community_ref)
      ensure_lifecycle!(lifecycle)
      ensure_expected_version!(lifecycle, opts)

      unless lifecycle.state == :pending_destroy do
        Repo.rollback(CommunityErrorCat.lifecycle_state_conflict())
      end

      now = DateTime.utc_now(:second)
      blockers = active_blockers(lifecycle.id)
      ensure_destroy_allowed!(blockers, now)
      operation_ref = resolve_operation_ref!(Keyword.get(opts, :operation_ref))

      Enum.each(blockers, fn blocker ->
        case blocker
             |> CommunityLifecycleBlocker.changeset(%{
               ended_at: now,
               end_type: :terminated,
               ended_by_operation_ref: operation_ref
             })
             |> Repo.update() do
          {:ok, ended} ->
            case write_audit(
                   lifecycle,
                   operation_ref,
                   "community.blocker_terminated",
                   %{
                     blocker_type: ended.blocker_type,
                     cause_ref: ended.cause_ref,
                     end_type: ended.end_type
                   }
                 ) do
              {:ok, _audit} -> :ok
              {:error, reason} -> Repo.rollback(reason)
            end

          {:error, reason} ->
            Repo.rollback(reason)
        end
      end)

      case Repo.update(transition_changeset(lifecycle, :destroy)) do
        {:ok, destroyed} ->
          case write_audit(
                 destroyed,
                 operation_ref,
                 "community.destroyed",
                 %{from_state: lifecycle.state, to_state: destroyed.state}
               ) do
            {:ok, _audit} -> destroyed
            {:error, reason} -> Repo.rollback(reason)
          end

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  @doc "Reconciles a Lifecycle row from its active blockers under a row lock."
  @spec reconcile(String.t() | integer()) :: {:ok, CommunityLifecycle.t()} | {:error, term()}
  def reconcile(community_ref), do: transition(community_ref, :__reconcile__, [])

  # Read/write/manage trust the materialized state. Every blocker mutation must
  # recompute that state in the same transaction to preserve this invariant.
  defp capability(resource, capability, context) do
    with {:ok, lifecycle} <- lifecycle_from(resource) do
      capability_allowed(capability, lifecycle, context)
    end
  end

  defp capability_allowed(:read, lifecycle, _context),
    do: {:ok, lifecycle.state in @public_readable_states}

  defp capability_allowed(:write, lifecycle, _context), do: {:ok, lifecycle.state == :active}

  defp capability_allowed(:manage, lifecycle, _context),
    do: {:ok, lifecycle.state in [:active, :read_only, :suspended, :archived, :pending_destroy]}

  defp capability_allowed(:destroy, lifecycle, context) do
    if lifecycle.state in [:active, :read_only, :archived] do
      with {:ok, blockers} <- capability_blockers(lifecycle, context) do
        {:ok, not Enum.any?(blockers, &(blocker_type(&1) in @destroy_blockers))}
      end
    else
      {:ok, false}
    end
  end

  defp capability_blockers(_lifecycle, %{active_blockers: blockers}) when is_list(blockers),
    do: {:ok, blockers}

  defp capability_blockers(%CommunityLifecycle{blockers: blockers}, _context)
       when is_list(blockers),
       do: {:ok, Enum.filter(blockers, &is_nil(&1.ended_at))}

  defp capability_blockers(_lifecycle, _context),
    do: {:error, GateErrorCat.lifecycle_not_loaded()}

  defp lifecycle_from(%CommunityLifecycle{} = lifecycle), do: {:ok, lifecycle}

  defp lifecycle_from(%Community{lifecycle: %CommunityLifecycle{} = lifecycle}),
    do: {:ok, lifecycle}

  defp lifecycle_from(%Community{}), do: {:error, GateErrorCat.lifecycle_not_loaded()}
  defp lifecycle_from(_), do: {:error, GateErrorCat.lifecycle_not_loaded()}

  defp allowed_transition?(from, to), do: to in Map.get(@allowed_transitions, from, [])

  defp lock_for_transition(ref) when is_integer(ref) do
    CommunityLifecycle
    |> where([lifecycle], lifecycle.community_id == ^ref)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp lock_for_transition(ref) when is_binary(ref) do
    CommunityLifecycle
    |> join(:inner, [lifecycle], community in Community,
      on: community.id == lifecycle.community_id
    )
    |> where([_lifecycle, community], community.slug == ^ref or community.aka == ^ref)
    |> select([lifecycle, _community], lifecycle)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp lock_for_transition_or_bootstrap(ref, opts) do
    case lock_for_transition(ref) do
      %CommunityLifecycle{} = lifecycle ->
        lifecycle

      nil ->
        if Keyword.get(opts, :bootstrap_missing, false) do
          community = lock_community(ref)

          if is_nil(community) do
            nil
          else
            state =
              if community.pending == Constant.CMS.pending(:normal),
                do: :active,
                else: :setting_up

            %CommunityLifecycle{}
            |> CommunityLifecycle.changeset(%{
              community_id: community.id,
              state: state,
              version: 1,
              changed_at: DateTime.utc_now(:second)
            })
            |> Repo.insert!()
          end
        else
          nil
        end
    end
  end

  defp lock_community(ref) when is_integer(ref) do
    Community
    |> where([community], community.id == ^ref)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp lock_community(ref) when is_binary(ref) do
    Community
    |> where([community], community.slug == ^ref or community.aka == ^ref)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp update_lifecycle(lifecycle, :__reconcile__, _attrs),
    do: recompute_locked(lifecycle, operation_ref: Ecto.UUID.generate())

  defp update_lifecycle(lifecycle, state, attrs),
    do: Repo.update(transition_changeset(lifecycle, state, attrs))

  defp recompute_locked(
         lifecycle,
         opts,
         audit_action \\ "community.lifecycle_reconciled",
         metadata \\ %{}
       )

  defp recompute_locked(
         %CommunityLifecycle{state: state} = lifecycle,
         _opts,
         _audit_action,
         _metadata
       )
       when state in [:pending_destroy, :destroy] do
    {:ok, lifecycle}
  end

  defp recompute_locked(lifecycle, opts, audit_action, metadata) do
    blockers = active_blockers(lifecycle.id)
    state = resolve_state(blockers)
    from_state = lifecycle.state
    attrs = %{changed_at: DateTime.utc_now(:second)}

    with {:ok, lifecycle} <- Repo.update(transition_changeset(lifecycle, state, attrs)),
         {:ok, _audit} <-
           write_audit(
             lifecycle,
             Keyword.get(opts, :operation_ref),
             audit_action,
             Map.merge(metadata, %{from_state: from_state, to_state: state})
           ) do
      {:ok, lifecycle}
    end
  end

  defp insert_blocker(attrs, opts) do
    attrs =
      attrs
      |> Map.put_new(:applied_at, DateTime.utc_now(:second))
      |> Map.put_new(
        :created_by_operation_ref,
        Keyword.fetch!(opts, :operation_ref)
      )

    %CommunityLifecycleBlocker{}
    |> CommunityLifecycleBlocker.changeset(attrs)
    |> Repo.insert()
  end

  defp active_blocker(attrs) do
    CommunityLifecycleBlocker
    |> where(
      [blocker],
      blocker.community_id == ^attrs.community_id and blocker.blocker_type == ^attrs.blocker_type and
        is_nil(blocker.ended_at)
    )
    |> maybe_cause_ref(Map.get(attrs, :cause_ref))
    |> Repo.one()
  end

  defp active_blockers(lifecycle_id) do
    if is_nil(lifecycle_id) do
      []
    else
      Repo.all(
        from(blocker in CommunityLifecycleBlocker,
          where: blocker.lifecycle_id == ^lifecycle_id and is_nil(blocker.ended_at)
        )
      )
    end
  end

  defp maybe_cause_ref(query, nil), do: where(query, [blocker], is_nil(blocker.cause_ref))

  defp maybe_cause_ref(query, cause_ref),
    do: where(query, [blocker], blocker.cause_ref == ^cause_ref)

  defp blocker_type(%{blocker_type: type}), do: type
  defp blocker_type(%{"blocker_type" => type}), do: type

  defp ensure_lifecycle!(nil), do: Repo.rollback(CommunityErrorCat.lifecycle_not_found())
  defp ensure_lifecycle!(%CommunityLifecycle{}), do: :ok

  defp ensure_not_destroyed!(%CommunityLifecycle{state: :destroy}),
    do: Repo.rollback(CommunityErrorCat.lifecycle_state_conflict())

  defp ensure_not_destroyed!(%CommunityLifecycle{}), do: :ok

  defp ensure_expected_version!(%CommunityLifecycle{version: version}, opts) do
    case Keyword.get(opts, :expected_version) do
      nil -> :ok
      ^version -> :ok
      _ -> Repo.rollback(CommunityErrorCat.lifecycle_state_conflict())
    end
  end

  defp ensure_state_allowed!(_lifecycle, nil), do: :ok

  defp ensure_state_allowed!(%CommunityLifecycle{state: state}, allowed_states)
       when is_list(allowed_states) do
    unless state in allowed_states do
      Repo.rollback(CommunityErrorCat.lifecycle_state_conflict())
    end
  end

  defp ensure_destroy_allowed!(blockers, now) do
    cond do
      Enum.any?(blockers, &(blocker_type(&1) in @destroy_blockers)) ->
        Repo.rollback(CommunityErrorCat.destroy_blocked())

      Enum.any?(blockers, &recovery_window_active?(&1, now)) ->
        Repo.rollback(CommunityErrorCat.archive_recovery_window_active())

      true ->
        :ok
    end
  end

  defp recovery_window_active?(%{blocker_type: type} = blocker, now)
       when type in @recoverable_archive_blockers do
    case Map.get(blocker, :recover_until) do
      nil -> false
      recover_until -> DateTime.compare(now, recover_until) == :lt
    end
  end

  defp recovery_window_active?(_blocker, _now), do: false

  defp transition_attrs(%CommunityLifecycle{} = lifecycle, state) do
    %{state: state, version: lifecycle.version + 1, changed_at: DateTime.utc_now(:second)}
    |> maybe_state_timestamp(state)
  end

  defp maybe_state_timestamp(attrs, :active),
    do: Map.put(attrs, :activated_at, DateTime.utc_now(:second))

  defp maybe_state_timestamp(attrs, :archived),
    do: Map.put(attrs, :archived_at, DateTime.utc_now(:second))

  defp maybe_state_timestamp(attrs, :pending_destroy),
    do: Map.put(attrs, :destroy_scheduled_at, DateTime.utc_now(:second))

  defp maybe_state_timestamp(attrs, :destroy),
    do: Map.put(attrs, :destroyed_at, DateTime.utc_now(:second))

  defp maybe_state_timestamp(attrs, _), do: attrs

  defp write_audit(lifecycle, operation_ref, action, metadata) do
    CMS.Audit.record(action, %{
      community_id: lifecycle.community_id,
      resource_type: "community",
      resource_ref: to_string(lifecycle.community_id),
      operation_ref: operation_ref,
      metadata: Map.put(metadata, :state, lifecycle.state)
    })
  end

  defp resolve_operation_ref!(nil), do: Ecto.UUID.generate()

  defp resolve_operation_ref!(ref) when is_binary(ref) do
    case Regex.match?(@uuid_pattern, ref) && Ecto.UUID.cast(ref) do
      {:ok, uuid} -> uuid
      :error -> Repo.rollback(CommunityErrorCat.invalid_operation_ref())
      false -> Repo.rollback(CommunityErrorCat.invalid_operation_ref())
    end
  end

  defp resolve_operation_ref!(_), do: Repo.rollback(CommunityErrorCat.invalid_operation_ref())
end
