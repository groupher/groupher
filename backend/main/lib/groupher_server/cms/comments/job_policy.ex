defmodule GroupherServer.CMS.Comments.JobPolicy do
  @moduledoc """
  Defines the required background-job contract shared by Comment mutations.

      create / reply / update transaction
        -> required audition enqueue
             -> success: continue toward commit
             -> {:error, reason}: stable Comments domain error + rollback
             -> raise/throw/exit: propagate after transaction rollback

  Optional jobs remain owned by `GroupherServer.Jobs.enqueue_best_effort/3` and
  run only after the mutation has committed.
  """

  alias GroupherServer.CMS.Comments.ErrorCat
  alias GroupherServer.CMS.Model.Comment
  alias GroupherServer.Jobs

  @doc """
  Enqueues the required audition job for one Comment.

  A normal enqueue error is converted to a safe, stable Comments error. Raised
  database failures deliberately propagate so the owning transaction rolls
  back without hiding an infrastructure exception.

  ## Examples

      Comments.JobPolicy.audition(comment)
      #=> {:ok, %Oban.Job{}} | {:error, domain_error}
  """
  @spec audition(Comment.t()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def audition(%Comment{} = comment), do: audition(comment, &Jobs.audition/1)

  @doc """
  Applies the required audition policy with an explicit enqueue function.

  This variant keeps the failure contract deterministic in tests without
  replacing Oban globally.

  ## Examples

      Comments.JobPolicy.audition(comment, fn _comment -> {:error, changeset} end)
  """
  @spec audition(Comment.t(), (Comment.t() -> {:ok, term()} | {:error, term()})) ::
          {:ok, term()} | {:error, term()}
  def audition(%Comment{} = comment, enqueue) when is_function(enqueue, 1) do
    case enqueue.(comment) do
      {:ok, _job} = success ->
        success

      {:error, _reason} ->
        {:error,
         ErrorCat.required_job_enqueue_failed(%{
           job: :audition,
           resource_ref: comment.id,
           failure: :validation
         })}

      _other ->
        {:error,
         ErrorCat.required_job_enqueue_failed(%{
           job: :audition,
           resource_ref: comment.id,
           failure: :unexpected_result
         })}
    end
  end
end
