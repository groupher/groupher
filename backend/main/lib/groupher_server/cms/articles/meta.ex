defmodule GroupherServer.CMS.Articles.Meta do
  @moduledoc """
  Article meta helpers.
  """

  import Helper.Utils, only: [get_config: 2, done: 1]

  alias Helper.Types, as: T
  alias Helper.ORM
  alias GroupherServer.CMS.Comments.CRUD
  alias GroupherServer.CMS.Model.{Embeds, Post}
  alias GroupherServer.CMS.Helper.ArticleEnums

  @active_period get_config(:article, :active_period_days)
  @article_cat ArticleEnums.cat_values() |> Enum.into(%{}, &{&1, &1})

  @spec set_cat(Post.t(), term()) :: T.domain_res(term())
  def set_cat(%Post{} = post, cat) do
    with {:ok, updated} <- ORM.update(post, %{cat: cat}),
         {:ok, _} <- CRUD.batch_update_question_flag(post, cat == @article_cat.question) do
      updated |> done
    end
  end

  @spec set_state(Post.t(), term()) :: T.domain_res(term())
  def set_state(%Post{} = post, state) do
    with {:ok, updated} <- ORM.update(post, %{state: state}) do
      updated |> done
    end
  end

  @spec update_active_timestamp(atom(), term()) :: T.domain_res(term())
  def update_active_timestamp(thread, article) do
    case in_active_period?(thread, article) do
      true -> ORM.update(article, %{active_at: DateTime.utc_now()})
      _ -> {:ok, :pass}
    end
  end

  @spec update_edit_status(term()) :: T.domain_res(term())
  def update_edit_status(%{meta: %Embeds.ArticleMeta{} = meta} = content) do
    meta = meta |> Map.merge(%{is_edited: true})
    ORM.update_meta(content, meta)
  end

  def update_edit_status(%{meta: nil} = content) do
    meta = Embeds.ArticleMeta.default_meta() |> Map.merge(%{is_edited: true})
    ORM.update_meta(content, meta)
  end

  def update_edit_status(content), do: {:ok, content}

  defp in_active_period?(thread, article) do
    active_period_days = @active_period[thread] || @active_period[:default]

    inserted_at = article.inserted_at
    active_threshold = Timex.shift(Timex.now(), days: -active_period_days)

    :gt == DateTime.compare(inserted_at, active_threshold)
  end

end
