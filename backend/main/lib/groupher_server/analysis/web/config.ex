defmodule GroupherServer.Analysis.Web.Config do
  @moduledoc """
  Typed configuration contract for built-in Web Analysis.

  `base/0` returns static provider and query defaults. `runtime/0` returns only
  runtime credentials injected through application environment.
  """

  alias GroupherServer.Analysis.Web.Provider.Umami

  @type t :: %__MODULE__{
          provider: module(),
          origin: String.t(),
          default_days: pos_integer(),
          max_days: pos_integer(),
          timeout: pos_integer(),
          metrics_limit: pos_integer(),
          concurrency: pos_integer(),
          retry_delay: non_neg_integer(),
          retry_count: non_neg_integer()
        }

  defstruct provider: Umami,
            origin: "https://analysis.groupher.com",
            default_days: 7,
            max_days: 90,
            timeout: 5_000,
            metrics_limit: 20,
            concurrency: 3,
            retry_delay: 200,
            retry_count: 1

  defmodule Runtime do
    @moduledoc """
    Runtime-only Web Analysis credentials.
    """

    @type t :: %__MODULE__{
            api_token: String.t() | nil
          }

    defstruct api_token: nil
  end

  @doc """
  Returns static Web Analysis defaults.

  This function does not read application environment or runtime secrets.

  ## Example

      GroupherServer.Analysis.Web.Config.base()
      #=> %GroupherServer.Analysis.Web.Config{origin: "https://analysis.groupher.com", default_days: 7, ...}

  """
  @spec base() :: t()
  def base, do: %__MODULE__{}

  @doc """
  Returns runtime Web Analysis credentials only.

  This function reads `config :groupher_server, :web_analysis`, but only keeps
  keys that belong to runtime credentials.

  ## Example

      config :groupher_server, :web_analysis,
        api_token: "token"

      GroupherServer.Analysis.Web.Config.runtime()
      #=> %GroupherServer.Analysis.Web.Config.Runtime{api_token: "token"}

  """
  @spec runtime() :: Runtime.t()
  def runtime do
    config =
      :groupher_server
      |> Application.get_env(:web_analysis, [])
      |> Enum.into(%{})

    struct!(Runtime, %{
      api_token: Map.get(config, :api_token)
    })
  end
end
