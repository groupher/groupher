defmodule GroupherServer.PublicCache do
  @moduledoc """
  Public contract for durable public-CDN invalidation.

  Domain code records a typed invalidation while its database transaction is
  open. `PublicCache.Persist` owns the row and lease mechanics; the durable
  Oban worker later resolves canonical tags and calls the Phoenix-owned
  Cloudflare adapter.

  Business position:

      domain transaction
        -> PublicCache facade
        -> Persist invalidation row
        -> Oban worker -> Cloudflare purge
  """

  alias GroupherServer.PublicCache
  alias PublicCache.{Model.Invalidation, Persist, Workflow}

  @doc """
  Adds an invalidation row and durable worker trigger to an Ecto.Multi.

  ## Examples

      PublicCache.invalidate(multi, :article_published, article, causation_id: command_id)
  """
  @spec invalidate(Ecto.Multi.t(), atom(), map() | struct(), keyword()) :: Ecto.Multi.t()
  defdelegate invalidate(multi, type, aggregate, opts), to: Persist

  @doc """
  Records an invalidation from a caller that is not already in a transaction.

  ## Examples

      PublicCache.invalidate_now(:article_published, article, causation_id: command_id)
  """
  @spec invalidate_now(atom(), map() | struct(), keyword()) ::
          {:ok, Invalidation.t()} | {:error, term()}
  defdelegate invalidate_now(type, aggregate, opts), to: Workflow

  @doc """
  Claims a pending or expired delivery lease with a fencing token.

  ## Examples

      PublicCache.claim(invalidation_id, lock_ref)
  """
  @spec claim(Ecto.UUID.t(), String.t()) ::
          {:ok,
           Invalidation.t()
           | {:busy, pos_integer()}
           | :dead
           | :delivered
           | :missing}
          | {:error, term()}
  defdelegate claim(id, lock_ref), to: Workflow

  @doc false
  defdelegate mark_delivered(id, lock_ref, type), to: Workflow

  @doc false
  defdelegate mark_failed(id, lock_ref, type, reason, dead?), to: Workflow

  @doc """
  Delivers one committed invalidation and returns the runtime-neutral outcome.

  ## Examples

      iex> GroupherServer.PublicCache.deliver(...)
  """
  @spec deliver(Ecto.UUID.t(), String.t(), pos_integer(), pos_integer()) ::
          {:ok, :pass | {:snooze, pos_integer()}} | {:error, term()}
  defdelegate deliver(id, lock_ref, attempt, max_attempts), to: Workflow

  @doc """
  Returns the retry delay for a PublicCache delivery attempt.

  ## Examples

      iex> GroupherServer.PublicCache.delivery_retry_delay(...)
  """
  @spec delivery_retry_delay(pos_integer()) :: pos_integer()
  defdelegate delivery_retry_delay(attempt), to: Workflow

  @doc """
  Returns the configured maximum number of PublicCache delivery attempts.

  ## Examples

      iex> GroupherServer.PublicCache.max_delivery_attempts(...)
  """
  @spec max_delivery_attempts() :: pos_integer()
  defdelegate max_delivery_attempts(), to: PublicCache.DeliveryConfig, as: :max_attempts

  @doc """
  Returns durable purge backlog health for readiness and operations checks.

  ## Examples

      PublicCache.health()
  """
  @spec health() :: map()
  defdelegate health(), to: Persist

  @doc """
  Delegates GroupherServer.PublicCache.Cloudflare.configured?/0 through the PublicCache Context boundary.

  ## Examples

      iex> GroupherServer.PublicCache.cloudflare_configured?(...)
  """
  defdelegate cloudflare_configured?(),
    to: GroupherServer.PublicCache.Cloudflare,
    as: :configured?

  @doc """
  Delegates PublicCache.Scope.tags/2 through the PublicCache Context boundary.

  ## Examples

      iex> GroupherServer.PublicCache.scope_tags(...)
  """
  defdelegate scope_tags(arg1, arg2), to: GroupherServer.PublicCache.Scope, as: :tags

  @doc """
  Builds the canonical public-cache tag for one Ticket list.

  ## Examples

      PublicCache.ticket_list_tag("acme")
      #=> "community[acme]-tickets"
  """
  defdelegate ticket_list_tag(community), to: GroupherServer.PublicCache.Tags, as: :ticket_list

  @doc """
  Builds the canonical public-cache tag for one Ticket detail.

  ## Examples

      PublicCache.ticket_detail_tag("acme", 42)
      #=> "community[acme]-ticket[42]"
  """
  defdelegate ticket_detail_tag(community, inner_id),
    to: GroupherServer.PublicCache.Tags,
    as: :ticket_detail

  @doc """
  Builds the canonical Article-list tag for a public thread.

  ## Examples

      PublicCache.article_list_tag("acme", :post)
      #=> "community[acme]-thread[post]-articles"
  """
  defdelegate article_list_tag(community, thread),
    to: GroupherServer.PublicCache.Tags,
    as: :article_list

  @doc """
  Builds the canonical Article-detail tag for a public thread.

  ## Examples

      PublicCache.article_detail_tag("acme", :post, 42)
      #=> "community[acme]-thread[post]-article[42]"
  """
  defdelegate article_detail_tag(community, thread, inner_id),
    to: GroupherServer.PublicCache.Tags,
    as: :article_detail

  @doc """
  Validates a batch against the public cache tag contract.

  ## Examples

      PublicCache.validate_tags([PublicCache.ticket_list_tag("acme")])
      #=> {:ok, ["community[acme]-tickets"]}
  """
  defdelegate validate_tags(tags), to: GroupherServer.PublicCache.Tags, as: :validate

  @doc """
  Returns the maximum number of tags accepted in one purge request.

  ## Examples

      PublicCache.max_tags_per_request()
      #=> 100
  """
  defdelegate max_tags_per_request(),
    to: GroupherServer.PublicCache.DeliveryConfig,
    as: :max_tags_per_request

  @doc """
  Purges an already validated batch of public-cache tags through the configured adapter.

  ## Examples

      PublicCache.purge_tags([PublicCache.ticket_list_tag("acme")])
  """
  def purge_tags(tags) when is_list(tags), do: cloudflare_purge(tags)

  @doc """
  Delegates PublicCache.Cloudflare.purge/1 through the PublicCache Context boundary.

  ## Examples

      iex> GroupherServer.PublicCache.cloudflare_purge(...)
  """
  defdelegate cloudflare_purge(arg1), to: GroupherServer.PublicCache.Cloudflare, as: :purge
end
