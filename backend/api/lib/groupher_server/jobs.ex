defmodule GroupherServer.Jobs do
  @moduledoc """
  Public boundary for constructing and scheduling background work.

  Business Contexts enqueue stable job intents here. Jobs workers decode their
  payload and re-enter the owning Context through its root Facade.

      Context caller -> Jobs -> Oban job -> owning Context Facade
  """

  @doc """
  Enqueues one typed Accounts event.

  ## Examples

      Jobs.account_event(:follow, user_id, follower_id)
  """
  defdelegate account_event(type, user_id, from_user_id), to: GroupherServer.Jobs.Workflow

  @doc """
  Enqueues one typed contribution-cache rebuild.

  ## Examples

      Jobs.contribution_cache(community_id)
  """
  defdelegate contribution_cache(community_id), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates comments_new/1 to the Jobs workflow owner.

  ## Examples

      Jobs.comments_new(%{"type" => "sync_mentions", "version" => 1, "payload" => %{}})
  """
  defdelegate comments_new(arg1), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates comments_new/2 to the Jobs workflow owner.

  ## Examples

      Jobs.comments_new(%{"type" => "sync_mentions"}, [queue: :default])
  """
  defdelegate comments_new(arg1, arg2), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates config_skip_enqueue?/0 to the Jobs workflow owner.

  ## Examples

      Jobs.config_skip_enqueue?()
  """
  defdelegate config_skip_enqueue?(), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates enqueue_best_effort/3 to the Jobs workflow owner.

  ## Examples

      Jobs.enqueue_best_effort(:optional_effect, 1, fn -> {:ok, :queued} end)
  """
  defdelegate enqueue_best_effort(arg1, arg2, arg3), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates public_cache_purge_job/1 to the Jobs workflow owner.

  ## Examples

      Jobs.public_cache_purge_job(Ecto.UUID.generate())
  """
  defdelegate public_cache_purge_job(arg1), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates public_cache_purge_new/1 to the Jobs workflow owner.

  ## Examples

      Jobs.public_cache_purge_new(%{invalidation_id: Ecto.UUID.generate()})
  """
  defdelegate public_cache_purge_new(arg1), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates public_cache_purge_new/2 to the Jobs workflow owner.

  ## Examples

      Jobs.public_cache_purge_new(%{invalidation_id: Ecto.UUID.generate()}, [queue: :public_cache])
  """
  defdelegate public_cache_purge_new(arg1, arg2), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates reconcile_comments_participants/3 to the Jobs workflow owner.

  ## Examples

      Jobs.reconcile_comments_participants(:post, Ecto.UUID.generate(), 12)
  """
  defdelegate reconcile_comments_participants(arg1, arg2, arg3), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates search_index/3 to the Jobs workflow owner.

  ## Examples

      Jobs.search_index(:upsert_article, :post, Ecto.UUID.generate())
  """
  defdelegate search_index(arg1, arg2, arg3), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates search_index_new/1 to the Jobs workflow owner.

  ## Examples

      Jobs.search_index_new(%{action: "upsert_article", thread: "post", ref: Ecto.UUID.generate()})
  """
  defdelegate search_index_new(arg1), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates search_index_new/2 to the Jobs workflow owner.

  ## Examples

      Jobs.search_index_new(%{action: "upsert_article"}, [queue: :search])
  """
  defdelegate search_index_new(arg1, arg2), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates snapshot_refresh/3 to the Jobs workflow owner.

  ## Examples

      Jobs.snapshot_refresh(:article, %{thread: :post, ids: [Ecto.UUID.generate()]}, [])
  """
  defdelegate snapshot_refresh(arg1, arg2, arg3), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates snapshot_refresh_new/1 to the Jobs workflow owner.

  ## Examples

      Jobs.snapshot_refresh_new(%{type: "article", version: 1, refs: %{}})
  """
  defdelegate snapshot_refresh_new(arg1), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates snapshot_refresh_new/2 to the Jobs workflow owner.

  ## Examples

      Jobs.snapshot_refresh_new(%{type: "article"}, [queue: :snapshot])
  """
  defdelegate snapshot_refresh_new(arg1, arg2), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates subscribe_community/2 to the Jobs workflow owner.

  ## Examples

      Jobs.subscribe_community(%{id: 10}, %{id: 20})
  """
  defdelegate subscribe_community(arg1, arg2), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates sync_mentions/1 to the Jobs workflow owner.

  ## Examples

      Jobs.sync_mentions(%{id: comment_id})
  """
  defdelegate sync_mentions(arg1), to: GroupherServer.Jobs.Workflow

  @doc """
  Delegates Jobs.CommunitySetup.new/1 through the Jobs Context boundary.

  ## Examples

      Jobs.community_setup_new(%{community_ref: "community_ref", application_ref: "application_ref", operation_ref: "operation_ref"})
  """
  defdelegate community_setup_new(arg1), to: GroupherServer.Jobs.CommunitySetup, as: :new

  @doc """
  Delegates Jobs.CommunitySetup.new/2 through the Jobs Context boundary.

  ## Examples

      Jobs.community_setup_new(%{community_ref: "community_ref"}, [queue: :community_setup])
  """
  defdelegate community_setup_new(arg1, arg2), to: GroupherServer.Jobs.CommunitySetup, as: :new

  @doc """
  Delegates Jobs.CreateCommunity.new/1 through the Jobs Context boundary.

  ## Examples

      Jobs.create_community_new(%{application_ref: "application_ref", operation_ref: "operation_ref"})
  """
  defdelegate create_community_new(arg1), to: GroupherServer.Jobs.CreateCommunity, as: :new

  @doc """
  Delegates Jobs.CreateCommunity.new/2 through the Jobs Context boundary.

  ## Examples

      Jobs.create_community_new(%{application_ref: "application_ref"}, [queue: :community_application])
  """
  defdelegate create_community_new(arg1, arg2), to: GroupherServer.Jobs.CreateCommunity, as: :new
end
