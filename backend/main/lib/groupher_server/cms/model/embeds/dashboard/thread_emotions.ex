defmodule GroupherServer.CMS.Model.Embeds.Dashboard.ThreadEmotions do
  @moduledoc """
  Community-level emotion availability overrides by thread.

  Article thread fields (`post`, `blog`, `changelog`, `doc`) control article emotions.
  Comment thread fields (`post_comment`, `blog_comment`, `changelog_comment`, `doc_comment`)
  control comment emotions under those article threads.

  Design intent:
  - this embed stores only availability decisions
  - emotion display metadata such as icon, label, or ordering stays on the frontend
  - absent values fall back to `default_thread_emotions`

  Example:

      %{
        post: [:heart],
        post_comment: [:beer, :heart]
      }

  means post articles only allow `heart`, while post comments allow both
  `beer` and `heart`.

  Business position:

      CMS context
        -> ThreadEmotions schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  @type t :: %__MODULE__{}

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  @threads GroupherServer.CMS.Artiment.Config.threads()
  @emotions_whitelist GroupherServer.CMS.Artiment.Config.emotions_whitelist()
  @article_emotions GroupherServer.CMS.Artiment.Config.emotions()
  @comment_emotions GroupherServer.CMS.Artiment.Config.comment_emotions()
  @default_thread_emotions GroupherServer.CMS.Artiment.Config.default_thread_emotions()

  @comment_thread_fields Enum.map(@threads, &:"#{&1}_comment")
  @thread_fields @threads ++ @comment_thread_fields

  @optional_fields @thread_fields

  @doc "for test usage"
  def default do
    Enum.reduce(@thread_fields, %{}, fn key, acc ->
      Map.put(acc, key, Map.get(@default_thread_emotions, key, []))
    end)
  end

  embedded_schema do
    for field_name <- @thread_fields do
      field(field_name, {:array, Ecto.Enum},
        values: @emotions_whitelist,
        default: Map.get(@default_thread_emotions, field_name, [])
      )
    end
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
    |> validate_scope(:article, @threads, @article_emotions)
    |> validate_scope(:comment, @comment_thread_fields, @comment_emotions)
  end

  defp validate_scope(changeset, _scope, fields, whitelist) do
    Enum.reduce(fields, changeset, fn field_name, acc ->
      values = get_field(acc, field_name, [])

      if Enum.all?(values, &(&1 in whitelist)) do
        acc
      else
        add_error(acc, field_name, "contains unsupported emotions for this thread")
      end
    end)
  end
end
