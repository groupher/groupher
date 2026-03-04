defmodule Helper.TestFakes.OpenGraph do
  @moduledoc false

  def fetch(url), do: fetch(url, [])

  def fetch(url, _opts) do
    case URI.parse(url).host do
      "github.com" ->
        {:ok,
         %OpenGraph{
           title: "GitHub",
           description: "Where the world builds software",
           image: "https://github.githubassets.com/images/modules/open_graph/github-mark.png"
         }}

      "zhuanlan.zhihu.com" ->
        {:ok,
         %OpenGraph{
           title: nil,
           description: "zhihu story feed",
           image: nil
         }}

      _ ->
        {:error, %OpenGraph.Error{reason: {:request_error, "nxdomain"}}}
    end
  end
end
