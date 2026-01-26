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

  # simulate editor.js fmt rich text
  def rich_text(text \\ "text") do
    """
    {
      "time": 111,
      "blocks": [
        {
          "id": "lldjfiek",
          "type": "paragraph",
          "data": {
            "text": "#{text}"
          }
        }
      ],
      "version": "2.22.0"
    }
    """
  end

  # for link tasks
  def rich_text(text1, text2) do
    """
    {
      "time": 111,
      "blocks": [
        {
          "id": "lldjfiek",
          "type": "paragraph",
          "data": {
            "text": "#{text1}"
          }
        },
        {
          "id": "llddiekek",
          "type": "paragraph",
          "data": {
            "text": "#{text2}"
          }
        }
      ],
      "version": "2.22.0"
    }
    """
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
