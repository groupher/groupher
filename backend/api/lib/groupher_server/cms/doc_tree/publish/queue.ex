defmodule GroupherServer.CMS.DocTree.Publish.Queue do
  @moduledoc """
  Internal entry to the Docs Queue's site-owned state primitives.

      admitted Docs command -> Queue -> caller-owned transaction and site lock

  The command remains responsible for admission, change decisions and effects.
  """

  alias __MODULE__.{Consume, Dequeue, Discard, Enqueue, Members, Merge, Save, Store, Tree}

  @doc "Reads the persisted Queue or an empty unpersisted site state."
  defdelegate read(community), to: Store

  @doc "Initializes and locks the Queue in the caller-owned transaction."
  defdelegate lock_or_create(community), to: Store

  @doc "Checks expected versions and advances the requested counters."
  defdelegate advance(community, queue, expected, changes), to: Store

  @doc "Updates approval configuration and its independent revision."
  defdelegate set_policy(
                community,
                queue,
                expected_revision,
                approval_required,
                allow_self_approval
              ),
              to: Store

  @doc "Registers a checked batch of forked Doc members within the caller transaction."
  defdelegate add_many(community, queue, revision, entries, actor), to: Members

  @doc "Freezes, forks and registers an admitted batch of default Doc revisions."
  defdelegate enqueue(community, queue, revision, entries, actor, command_id), to: Enqueue

  @doc "Reconciles the admitted complete directory target with its public baseline."
  defdelegate reconcile_tree(community, queue, revision, public_nodes, target_nodes, actor),
    to: Tree,
    as: :reconcile

  @doc "Records one actor of an actual Queue-copy content change."
  defdelegate record_contribution(community, queue, revision, article_id, actor), to: Members

  @doc "Checks a discard confirmation using the complete locked operation and Doc states."
  defdelegate check_discard(operation, revision, documents, confirmation \\ nil),
    to: Discard,
    as: :check

  @doc "Removes a checked batch of Queue members within the caller transaction."
  defdelegate remove_many(community, queue, revision, ids, operation, confirmation \\ nil),
    to: Dequeue

  @doc "Consumes content and directory members for the checked sealed Release."
  defdelegate consume_release(community, queue, revision, release_id, entries),
    to: Consume,
    as: :release

  @doc "Saves the Queue-owned copy of one admitted Doc."
  defdelegate save(community, queue, queue_revision, article_id, work_revision, attrs, actor),
    to: Save

  @doc "Absorbs a default Doc revision into the Queue-owned copy."
  defdelegate merge(
                community,
                queue,
                queue_revision,
                article_id,
                default_revision,
                work_revision,
                choices,
                actor,
                command_id
              ),
              to: Merge
end
