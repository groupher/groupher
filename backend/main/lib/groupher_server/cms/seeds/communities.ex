defmodule GroupherServer.CMS.Seeds.Communities do
  @moduledoc """
  communities seeds
  """

  import Helper.Utils, only: [done: 1]

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Seeds.Domain

  alias CMS.Model.Community
  alias Helper.{ORM, T}

  @community_types [:pl, :framework]
  @default_threads [:post, :changelog, :kanban, :doc, :about]

  @spec communities(atom()) :: T.domain_res(:ok)
  def communities(type) when type in @community_types do
    get(type) |> Enum.each(&mock(&1, type)) |> done
  end

  @spec mock(String.t() | atom()) :: T.domain_res(Community.t())
  def mock(:home), do: Domain.seed_community(:home)
  def mock(:feedback), do: Domain.seed_community(:feedback)

  def mock(slug, type_or_opts \\ [])

  @spec mock(atom(), atom()) :: T.domain_res(Community.t())
  def mock(slug, type) when type in @community_types do
    Domain.community(slug, type)
  end

  def mock(_slug, type) when is_atom(type), do: {:error, {:custom, "unknown community type"}}

  @spec mock(String.t() | atom(), keyword()) :: T.domain_res(Community.t())
  def mock(slug, opts) when is_list(opts) do
    slug = slug |> to_string() |> String.trim()
    title = Keyword.get(opts, :title, String.capitalize(slug))

    with {:ok, user} <- GroupherServer.CMS.Seeds.Helper.seed_bot(),
         {:ok, community} <- find_or_create(slug, title, user),
         {:ok, _} <- ensure_about_enabled(community) do
      CMS.Communities.read(community.slug, inc_views: false)
    end
  end

  @spec set_category([atom() | String.t()], atom() | String.t()) :: T.domain_res(:ok)
  def set_category(communities_names, cat_name) when is_list(communities_names) do
    Domain.set_category(communities_names, cat_name)
  end

  defp find_or_create(slug, title, user) do
    case ORM.find_by(Community, %{slug: slug}) do
      {:ok, community} ->
        {:ok, community}

      {:error, _} ->
        CMS.Communities.create(
          %{
            title: title,
            slug: slug,
            desc: "#{slug} is awesome!",
            logo: "https://assets.groupher.com/communities/groupher-alpha.png"
          },
          user
        )
    end
  end

  defp ensure_about_enabled(%Community{} = community) do
    enable =
      @default_threads
      |> Enum.reduce(%{}, fn thread, acc -> Map.put(acc, thread, true) end)
      |> Map.merge(%{
        about_techstack: true,
        about_location: true,
        about_links: true,
        about_media_report: true
      })

    CMS.Dashboard.update(community, :enable, enable)
  end

  def get(:pl) do
    [
      "c",
      "clojure",
      "cpp",
      "csharp",
      "dart",
      "delphi",
      "elm",
      "erlang",
      "fsharp",
      "go",
      "gradle",
      "groovy",
      "java",
      "javascript",
      "julia",
      "kotlin",
      "lisp",
      "lua",
      "ocaml",
      "perl",
      "php",
      "python",
      "ruby",
      "r",
      "racket",
      "red",
      "reason",
      "rust",
      "scala",
      "haskell",
      "swift",
      "typescript",
      "elixir",
      # new
      "deno",
      "crystal",
      "hack",
      "nim",
      "fasm",
      "zig",
      "prolog"
    ]
  end

  def get(:framework) do
    [
      "backbone",
      "d3",
      "django",
      "drupal",
      "eggjs",
      "electron",
      "laravel",
      "meteor",
      "nestjs",
      "nuxtjs",
      "nodejs",
      "phoenix",
      "rails",
      "react",
      "sails",
      "zend",
      "vue",
      "angular",
      "tensorflow",
      # mobile
      "android",
      "ios",
      "react-native",
      "weex",
      "xamarin",
      "nativescript",
      "ionic",
      # new
      "rxjs",
      "flutter",
      "taro",
      "webrtc",
      "wasm"
    ]
  end

  def get(:editor) do
    ["vim", "atom", "emacs", "vscode", "visualstudio", "jetbrains"]
  end

  def get(:database) do
    [
      "oracle",
      "hive",
      "spark",
      "hadoop",
      "cassandra",
      "elasticsearch",
      "sql-server",
      "neo4j",
      "mongodb",
      "mysql",
      "postgresql",
      "redis"
    ]
  end

  def get(:city) do
    [
      "beijing",
      "shanghai",
      "shenzhen",
      "hangzhou",
      "guangzhou",
      "chengdu",
      "wuhan",
      "xiamen",
      "nanjing"
    ]
  end

  def get(:devops) do
    # gcp -> google-cloud-platform
    # search google: devops tools
    ["git", "docker", "kubernetes", "jenkins", "puppet", "aws", "azure", "aliyun", "gcp"]
  end
end
