defmodule GroupherServer.Support.Factory.Articles do
  @moduledoc false

  defmacro __using__(_opts) do
    quote do
      def mock_rich_text(text \\ "text"), do: unquote(__MODULE__).rich_text(text)
      def mock_rich_text(text1, text2), do: unquote(__MODULE__).rich_text(text1, text2)

      defp mock_meta(:post) do
        unquote(__MODULE__).post_base(@default_article_meta, @default_emotions)
        |> Map.merge(%{
          author: mock(:author),
          community: mock(:community),
          communities: [mock(:community), mock(:community)]
        })
      end

      defp mock_meta(:changelog) do
        unquote(__MODULE__).changelog_base(@default_article_meta, @default_emotions)
        |> Map.merge(%{
          author: mock(:author),
          community: mock(:community),
          communities: [mock(:community), mock(:community)]
        })
      end

      defp mock_meta(:doc) do
        unquote(__MODULE__).doc_base(@default_article_meta, @default_emotions)
        |> Map.merge(%{
          author: mock(:author),
          community: mock(:community),
          communities: [mock(:community), mock(:community)]
        })
      end

      defp mock_meta(:blog) do
        unquote(__MODULE__).blog_base(@default_article_meta, @default_emotions)
        |> Map.merge(%{
          author: mock(:author),
          community: mock(:community),
          communities: [mock(:community)]
        })
      end
    end
  end

  # simulate plate json rich text
  def rich_text(text \\ "text") do
    Jason.encode!([
      %{
        "type" => "h1",
        "children" => [%{"text" => "Plate Editor"}],
        "id" => "nW7cgo_LSx",
        "_id" => "nW7cgo_LSx"
      },
      %{
        "type" => "p",
        "children" => [
          %{"text" => "Use "},
          %{"text" => "/", "bold" => true},
          %{"text" => " to open the slash menu and "},
          %{"text" => "@", "bold" => true},
          %{"text" => " to mention."}
        ],
        "id" => "dCVmhLWEzu",
        "_id" => "dCVmhLWEzu"
      },
      %{
        "type" => "blockquote",
        "children" => [%{"text" => "A short quote block for emphasis."}],
        "id" => "NLDkQ0yCjK",
        "_id" => "NLDkQ0yCjK"
      },
      %{
        "type" => "callout",
        "icon" => "🎉",
        "children" => [%{"text" => "Callout blocks highlight important notes.dfjeifje"}],
        "id" => "sqRyYHuGm_",
        "_id" => "sqRyYHuGm_"
      },
      %{
        "children" => [%{"text" => text}],
        "type" => "p",
        "id" => "Ez1rrIxqkN",
        "_id" => "Ez1rrIxqkN",
        "indent" => 1,
        "listStyleType" => "todo"
      },
      %{
        "type" => "p",
        "id" => "yEoHd9OU2O",
        "children" => [%{"text" => ""}],
        "_id" => "yEoHd9OU2O"
      },
      %{
        "type" => "toggle",
        "id" => "toggle-1",
        "children" => [%{"text" => "Toggle blocks can hide content."}],
        "_id" => "toggle-1"
      },
      %{
        "type" => "toggle",
        "id" => "n9y5GgqZEU",
        "_id" => "n9y5GgqZEU",
        "children" => [%{"text" => "sdwdw"}],
        "indent" => 2
      },
      %{
        "type" => "toggle",
        "id" => "TRiak7Ss18",
        "_id" => "TRiak7Ss18",
        "children" => [%{"text" => "djfief"}],
        "indent" => 1
      },
      %{
        "type" => "p",
        "indent" => 1,
        "listStyleType" => "disc",
        "children" => [%{"text" => "eijfd"}],
        "id" => "_NNIJ5591A",
        "_id" => "_NNIJ5591A"
      },
      %{
        "type" => "p",
        "indent" => 1,
        "listStyleType" => "disc",
        "id" => "igL0VixCLu",
        "_id" => "igL0VixCLu",
        "children" => [%{"text" => "jijdjfie"}],
        "listStart" => 2
      },
      %{
        "type" => "p",
        "indent" => 1,
        "listStyleType" => "disc",
        "id" => "Rdegg9psQu",
        "_id" => "Rdegg9psQu",
        "listStart" => 3,
        "children" => [%{"text" => ""}]
      },
      %{
        "type" => "p",
        "indent" => 1,
        "listStyleType" => "disc",
        "id" => "S1BthnDPmQ",
        "children" => [%{"text" => "eijf"}],
        "_id" => "S1BthnDPmQ",
        "listStart" => 4
      },
      %{
        "type" => "p",
        "indent" => 1,
        "listStyleType" => "disc",
        "id" => "-L60yU-phH",
        "children" => [%{"text" => "fiejfedijflleted list item."}],
        "listStart" => 5,
        "_id" => "-L60yU-phH"
      },
      %{
        "type" => "p",
        "indent" => 1,
        "listStyleType" => "decimal",
        "children" => [%{"text" => "Numbered list item."}],
        "id" => "1Xc-VNC0Y7",
        "_id" => "1Xc-VNC0Y7"
      },
      %{
        "type" => "p",
        "indent" => 1,
        "listStyleType" => "decimal",
        "id" => "PwdneO0vdX",
        "_id" => "PwdneO0vdX",
        "children" => [%{"text" => "dfdfe"}],
        "listStart" => 2
      },
      %{
        "type" => "p",
        "indent" => 1,
        "listStyleType" => "decimal",
        "id" => "6iXMQ_Zr4R",
        "_id" => "6iXMQ_Zr4R",
        "listStart" => 3,
        "children" => [%{"text" => "dfefe"}]
      },
      %{
        "type" => "p",
        "id" => "NpTpjkRkPy",
        "children" => [%{"text" => ""}],
        "_id" => "NpTpjkRkPy"
      },
      %{
        "type" => "p",
        "id" => "jrq-q__wIQ",
        "children" => [
          %{"text" => "fjief "},
          %{"text" => "djfiefkdjfi", "bold" => true, "italic" => true},
          %{"text" => " "},
          %{"text" => "djfiefe ", "strikethrough" => true},
          %{"text" => "dfefe dfef"}
        ],
        "_id" => "jrq-q__wIQ"
      },
      %{
        "type" => "p",
        "id" => "mL7LW3CklY",
        "_id" => "mL7LW3CklY",
        "children" => [
          %{"text" => "- dfjief "},
          %{
            "key" => "1",
            "children" => [%{"text" => ""}],
            "type" => "mention",
            "value" => "李四",
            "id" => "V02eytxw6m"
          },
          %{"text" => " djfie "},
          %{
            "key" => "2",
            "children" => [%{"text" => ""}],
            "type" => "mention",
            "value" => "王五",
            "id" => "mMJgMhxboC"
          },
          %{"text" => ""}
        ]
      },
      %{
        "type" => "p",
        "id" => "TMvLC98SHv",
        "_id" => "TMvLC98SHv",
        "children" => [%{"text" => ""}]
      },
      %{
        "type" => "p",
        "id" => "3B2aSjnHQM",
        "children" => [%{"text" => ""}],
        "_id" => "3B2aSjnHQM"
      },
      %{
        "type" => "p",
        "id" => "BBpIPwTAod",
        "children" => [%{"text" => "wwwwdfjie"}],
        "indent" => 1,
        "checked" => false,
        "listStyleType" => "todo",
        "_id" => "BBpIPwTAod"
      },
      %{
        "type" => "p",
        "id" => "c8rEVyzd0G",
        "checked" => false,
        "children" => [
          %{"text" => "hello "},
          %{
            "key" => "1",
            "children" => [%{"text" => ""}],
            "type" => "mention",
            "value" => "李四",
            "id" => "D43AuBu9EV"
          },
          %{"text" => "fefe"}
        ],
        "_id" => "c8rEVyzd0G",
        "listStart" => 2,
        "listStyleType" => "todo",
        "indent" => 1
      }
    ])
  end

  # for link tasks
  def rich_text(text1, text2) do
    Jason.encode!([
      %{
        "type" => "p",
        "children" => [%{"text" => text1}],
        "id" => "block-1",
        "_id" => "block-1"
      },
      %{
        "type" => "p",
        "children" => [%{"text" => text2}],
        "id" => "block-2",
        "_id" => "block-2"
      }
    ])
  end

  def comment_rich_text(text \\ "comment") do
    Jason.encode!([
      %{
        "type" => "p",
        "children" => [%{"text" => text}],
        "id" => "comment-block",
        "_id" => "comment-block"
      }
    ])
  end

  def article_base(meta, title, text, default_emotions, opts \\ []) do
    active_at_offset = Keyword.get(opts, :active_at_offset, -1)

    active_at =
      Timex.shift(Timex.now(), seconds: active_at_offset)
      |> DateTime.truncate(:second)

    %{
      meta: meta,
      title: title,
      body: rich_text(text),
      views: 0,
      emotions: default_emotions,
      active_at: active_at,
      pending: 0
    }
  end

  def post_base(default_article_meta, default_emotions) do
    text = Faker.Lorem.sentence(10)

    title = "post-#{String.slice(text, 1, 49)}"

    article_base(
      default_article_meta,
      title,
      text,
      default_emotions
    )
    |> Map.merge(%{
      digest: String.slice(text, 100, 150),
      solution_digest: String.slice(text, 1, 150)
    })
  end

  def changelog_base(default_article_meta, default_emotions) do
    text = Faker.Lorem.sentence(10)

    title = "changelog-#{String.slice(text, 1, 49)}"
    meta = Map.merge(default_article_meta, %{thread: "CHANGELOG"})

    article_base(
      meta,
      title,
      text,
      default_emotions
    )
    |> Map.merge(%{
      digest: String.slice(text, 100, 150),
      solution_digest: String.slice(text, 1, 150),
      length: String.length(text)
    })
  end

  def doc_base(default_article_meta, default_emotions) do
    text = Faker.Lorem.sentence(10)

    title = "doc-#{String.slice(text, 1, 49)}"
    meta = Map.merge(default_article_meta, %{thread: "DOC"})

    article_base(
      meta,
      title,
      text,
      default_emotions
    )
    |> Map.merge(%{
      digest: String.slice(text, 100, 150),
      solution_digest: String.slice(text, 1, 150),
      length: String.length(text)
    })
  end

  def blog_base(default_article_meta, default_emotions) do
    text = Faker.Lorem.sentence(10)

    title = "blog-#{String.slice(text, 1, 49)}"
    meta = Map.merge(default_article_meta, %{thread: "BLOG"})

    article_base(
      meta,
      title,
      text,
      default_emotions,
      active_at_offset: 1
    )
    |> Map.merge(%{length: String.length(text)})
  end
end
