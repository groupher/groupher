defmodule GroupherServer.CMS.ContentImport.Platforms.FileEntry do
  @moduledoc false

  alias GroupherServer.CMS.ContentImport.Entry

  @content_extensions MapSet.new(~w(.md .mdx .json .yaml .yml .toml .ts .tsx .js .jsx .mjs .cjs))
  @asset_extensions MapSet.new(
                      ~w(.png .jpg .jpeg .gif .webp .avif .svg .ico .pdf .zip .woff .woff2 .ttf .otf)
                    )
  @ignored_segments MapSet.new(~w(.git .next .turbo build dist node_modules coverage))

  @spec allowed_path?(String.t()) :: boolean()
  def allowed_path?(path) when is_binary(path) do
    extension = path |> Path.extname() |> String.downcase()
    segments = Path.split(path)

    not Enum.any?(segments, &MapSet.member?(@ignored_segments, &1)) and
      (MapSet.member?(@content_extensions, extension) or
         MapSet.member?(@asset_extensions, extension))
  end

  @spec build(String.t(), binary(), keyword()) :: {:ok, Entry.t()} | {:error, map()}
  def build(path, body, opts \\ []) when is_binary(path) and is_binary(body) do
    normalized_path = normalize_path(path)
    extension = normalized_path |> Path.extname() |> String.downcase()
    kind = if MapSet.member?(@asset_extensions, extension), do: :asset, else: :file

    metadata =
      opts
      |> Keyword.get(:metadata, %{})
      |> Map.put_new(:size, byte_size(body))
      |> maybe_put(:mime_type, mime_type(extension))

    Entry.new(%{
      external_ref: normalized_path,
      kind: kind,
      path: normalized_path,
      body: body,
      body_format: body_format(extension),
      metadata: metadata,
      source_url: Keyword.get(opts, :source_url),
      revision: Keyword.get(opts, :revision)
    })
  end

  @spec normalize_path(String.t()) :: String.t()
  def normalize_path(path) do
    path
    |> String.replace("\\", "/")
    |> String.trim_leading("./")
  end

  defp body_format(".md"), do: :md
  defp body_format(".mdx"), do: :mdx
  defp body_format(".json"), do: :json
  defp body_format(".yaml"), do: :yaml
  defp body_format(".yml"), do: :yaml

  defp body_format(extension) when extension in [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    do: :source

  defp body_format(_extension), do: nil

  defp mime_type(".png"), do: "image/png"
  defp mime_type(extension) when extension in [".jpg", ".jpeg"], do: "image/jpeg"
  defp mime_type(".gif"), do: "image/gif"
  defp mime_type(".webp"), do: "image/webp"
  defp mime_type(".avif"), do: "image/avif"
  defp mime_type(".svg"), do: "image/svg+xml"
  defp mime_type(".pdf"), do: "application/pdf"
  defp mime_type(_extension), do: nil

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
