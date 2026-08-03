defmodule GroupherServer.Statistics.Config do
  @moduledoc """
  Static configuration contract for statistics.
  """

  @general_config Application.compile_env(:groupher_server, :general, [])

  @type t :: %__MODULE__{
          community_contribute_days: pos_integer(),
          user_contribute_months: pos_integer()
        }

  defstruct community_contribute_days: Keyword.get(@general_config, :community_contribute_days),
            user_contribute_months: Keyword.get(@general_config, :user_contribute_months)

  @spec base() :: t()
  def base, do: %__MODULE__{}

  @spec community_contribute_days() :: pos_integer()
  def community_contribute_days, do: base().community_contribute_days

  @spec user_contribute_months() :: pos_integer()
  def user_contribute_months, do: base().user_contribute_months

end
