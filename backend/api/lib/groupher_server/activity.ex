defmodule GroupherServer.Activity do
  @moduledoc """
  Public boundary for durable Activity records and audit-log reads.

  Callers record domain activity or query community/article logs here without
  depending on Activity schemas, persistence, or workflow modules.

      domain / transport caller -> Activity -> Workflow / Query -> activity result
  """

  @doc """
  Delegates const_normalize_source/1 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.const_normalize_source(...)
  """
  defdelegate const_normalize_source(arg1), to: GroupherServer.Activity.Workflow

  @doc """
  Checks whether a source belongs to the Activity vocabulary.

      pipeline runner -> Activity -> Activity workflow/const boundary

  ## Examples

      GroupherServer.Activity.const_valid_source?(:api)
  """
  defdelegate const_valid_source?(arg1), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates export_community_logs/4 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.export_community_logs(...)
  """
  defdelegate export_community_logs(arg1, arg2, arg3, arg4), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates get_community_log_config/2 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.get_community_log_config(...)
  """
  defdelegate get_community_log_config(arg1, arg2), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates get_community_log_event/3 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.get_community_log_event(...)
  """
  defdelegate get_community_log_event(arg1, arg2, arg3), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates get_community_log_stats/3 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.get_community_log_stats(...)
  """
  defdelegate get_community_log_stats(arg1, arg2, arg3), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates list_article_logs/2 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.list_article_logs(...)
  """
  defdelegate list_article_logs(arg1, arg2), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates list_article_logs/3 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.list_article_logs(...)
  """
  defdelegate list_article_logs(arg1, arg2, arg3), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates list_community_logs/3 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.list_community_logs(...)
  """
  defdelegate list_community_logs(arg1, arg2, arg3), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates list_community_logs/4 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.list_community_logs(...)
  """
  defdelegate list_community_logs(arg1, arg2, arg3, arg4), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates log/2 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.log(...)
  """
  defdelegate log(arg1, arg2), to: GroupherServer.Activity.Workflow

  @doc """
  Delegates log/3 to the Context workflow owner.

  ## Examples

      iex> GroupherServer.Activity.log(...)
  """
  defdelegate log(arg1, arg2, arg3), to: GroupherServer.Activity.Workflow

  @doc """
  Appends one rejected Activity event through the narrow audit boundary.

  ## Examples

      Activity.log_rejection(article, :trashed,
        actor: actor,
        rejection_code: :forbidden,
        operation_ref: operation_ref
      )
  """
  @spec log_rejection(struct() | map(), atom(), keyword()) :: {:ok, struct()} | {:error, term()}
  def log_rejection(resource, action, opts) when is_list(opts) do
    cond do
      not Keyword.has_key?(opts, :actor) ->
        {:error, GroupherServer.Activity.ErrorCat.invalid_actor()}

      not Keyword.has_key?(opts, :rejection_code) ->
        {:error, GroupherServer.Activity.ErrorCat.invalid_payload()}

      not Keyword.has_key?(opts, :operation_ref) ->
        {:error, GroupherServer.Activity.ErrorCat.invalid_operation_ref()}

      true ->
        opts = opts |> Keyword.delete(:outcome) |> Keyword.put(:outcome, :denied)
        GroupherServer.Activity.Workflow.log(resource, action, opts)
    end
  end

  def log_rejection(_resource, _action, _opts) do
    {:error, GroupherServer.Activity.ErrorCat.invalid_payload()}
  end

  @doc """
  Delegates Activity.EventRef.derive/1 through the Activity Context boundary.

  ## Examples

      iex> GroupherServer.Activity.event_ref_derive(...)
  """
  defdelegate event_ref_derive(arg1), to: GroupherServer.Activity.EventRef, as: :derive
end
