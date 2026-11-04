defmodule GroupherServer.CMS.Review.Config do
  @moduledoc """
  Runtime policy for CMS review.

      Application configuration
        -> CMS.Review.Config
          -> report threshold command policy
  """

  @spec report_threshold() :: pos_integer()
  def report_threshold do
    case Application.fetch_env!(:groupher_server, :cms_review_report_threshold) do
      threshold when is_integer(threshold) and threshold > 0 -> threshold
      _ -> raise ArgumentError, "cms_review_report_threshold must be a positive integer"
    end
  end
end
