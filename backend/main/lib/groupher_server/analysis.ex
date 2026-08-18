defmodule GroupherServer.Analysis do
  @moduledoc """
  Platform analysis context.

  Analysis groups product-facing metrics and trend DTOs by data source and
  domain dimension. The current implemented dimension is `Analysis.Web`;
  contribution analytics can be added here without treating web analytics as
  the whole analysis domain.

  Business position:

      Application caller
        -> Analysis
        -> domain / infrastructure boundary
  """

  alias __MODULE__.Contribution

  @doc "Records contribution facts for the supplied user or community subject."
  defdelegate make_contribution(subject), to: Contribution

  @doc "Returns the contribution digest associated with the supplied subject."
  defdelegate list_contributions_digest(subject), to: Contribution
end
