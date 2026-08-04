defmodule GroupherServer.Accounts.Config do
  @moduledoc """
  Static configuration contract for accounts.
  """

  @general_config Application.compile_env(:groupher_server, :general, [])

  @type t :: %__MODULE__{
          default_subscribed_communities: pos_integer(),
          achieve_upvote_weight: non_neg_integer(),
          achieve_collect_weight: non_neg_integer(),
          achieve_follow_weight: non_neg_integer()
        }

  defstruct default_subscribed_communities:
              Keyword.get(@general_config, :default_subscribed_communities),
            achieve_upvote_weight: Keyword.get(@general_config, :user_achieve_upvote_weight),
            achieve_collect_weight: Keyword.get(@general_config, :user_achieve_collect_weight),
            achieve_follow_weight: Keyword.get(@general_config, :user_achieve_follow_weight)

  @spec base() :: t()
  def base, do: %__MODULE__{}

  @spec default_subscribed_communities() :: pos_integer()
  def default_subscribed_communities, do: base().default_subscribed_communities

  @spec achieve_upvote_weight() :: non_neg_integer()
  def achieve_upvote_weight, do: base().achieve_upvote_weight

  @spec achieve_collect_weight() :: non_neg_integer()
  def achieve_collect_weight, do: base().achieve_collect_weight

  @spec achieve_follow_weight() :: non_neg_integer()
  def achieve_follow_weight, do: base().achieve_follow_weight
end
