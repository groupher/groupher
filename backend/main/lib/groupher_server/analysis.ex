defmodule GroupherServer.Analysis do
  @moduledoc """
  Platform analysis context.

  Analysis groups product-facing metrics and trend DTOs by data source and
  domain dimension. The current implemented dimension is `Analysis.Web`;
  contribution analytics can be added here without treating web analytics as
  the whole analysis domain.
  """

  alias __MODULE__.Contribution

  defdelegate make_contribution(subject), to: Contribution
  defdelegate list_contributions_digest(subject), to: Contribution
end
