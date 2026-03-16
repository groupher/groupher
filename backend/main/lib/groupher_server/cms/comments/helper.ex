defmodule GroupherServer.CMS.Comments.Helper do
  @moduledoc """
  Shared helper functions for comments module.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [strip_struct: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias CMS.FrontDesk
  alias CMS.Model.{Comment, Embeds}
  alias Accounts.Model.User

  alias Helper.{ContentPipeline, ORM, T}

  @max_participator_count Comment.max_participator_count()
  @default_emotions Embeds.CommentEmotion.default_emotions()
  @default_comment_meta Embeds.CommentMeta.default_meta()

  @spec can_comment?(map(), User.t()) :: boolean()
  def can_comment?(article, _user) do
    not article.meta.is_comment_locked
  end

  @spec do_create_comment(String.t(), atom(), map(), User.t(), map() | nil) ::
          T.domain_res(Comment.t())
  def do_create_comment(body, foreign_key, article, user, reply_to_comment \\ nil) do
    %User{id: user_id} = user

    with {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
      thread = foreign_key |> to_string |> String.trim_trailing("_id") |> String.upcase()

      # 设置 root_comment_id：如果是回复评论，则使用被回复评论的 root_comment_id（如果存在）或其 ID
      root_comment_id =
        case reply_to_comment do
          nil -> nil
          %{root_comment_id: root_id} when not is_nil(root_id) -> root_id
          %{id: reply_to_id} -> reply_to_id
        end

      attrs = %{
        author_id: user_id,
        body: payload.json,
        body_html: payload.html,
        emotions: @default_emotions,
        floor: next_floor(article, foreign_key),
        is_article_author: user_id == article.author.user.id,
        thread: thread,
        meta: @default_comment_meta,
        root_comment_id: root_comment_id
      }

      Comment |> ORM.create(Map.put(attrs, foreign_key, article.id))
    end
  end

  @spec add_participant_to_article(map(), User.t()) :: T.domain_res(term())
  def add_participant_to_article(
        %{comments_participants: _participants} = article,
        %User{} = user
      ) do
    with {:ok, locked_article} <- ORM.lock_article(article) do
      normalized_participants =
        locked_article.comments_participants
        |> Enum.map(&Embeds.User.normalize/1)
        |> Enum.filter(&Embeds.User.valid?/1)

      cur_participants =
        normalized_participants
        |> List.insert_at(0, Embeds.User.from_account_user(user))
        |> Enum.filter(&Embeds.User.valid?/1)
        |> Enum.uniq_by(&Embeds.User.uniq_key/1)

      meta = locked_article.meta |> strip_struct

      cur_participants_ids =
        (meta.comments_participant_user_ids ++ [user.id])
        |> Enum.reject(&is_nil/1)
        |> Enum.uniq()

      meta = Map.merge(meta, %{comments_participant_user_ids: cur_participants_ids})

      latest_participants = cur_participants |> Enum.slice(0, @max_participator_count)

      locked_article = %{locked_article | comments_participants: normalized_participants}

      with {:ok, article} <-
             locked_article
             |> Ecto.Changeset.change()
             |> Ecto.Changeset.put_change(
               :comments_participants_count,
               length(cur_participants_ids)
             )
             |> Ecto.Changeset.put_embed(:comments_participants, latest_participants)
             |> Repo.update() do
        ORM.update_meta(article, meta)
      end
    end
  end

  def add_participant_to_article(_, _), do: {:ok, :pass}

  @spec next_floor(map(), atom()) :: integer()
  def next_floor(article, _foreign_key) do
    # 使用 ORM.inc_meta 函数原子递增 next_floor 字段，避免竞态条件
    {:ok, _updated_article, new_floor} = ORM.inc_meta(article, :next_floor)
    new_floor
  end

  @spec mark_viewer_has_upvoted(map(), User.t() | nil) :: map()
  def mark_viewer_has_upvoted(paged_comments, nil), do: paged_comments

  def mark_viewer_has_upvoted(%{entries: entries} = paged_comments, %User{} = user) do
    entries =
      Enum.map(
        entries,
        fn comment ->
          replies =
            Enum.map(comment.replies, fn reply_comment ->
              Map.merge(reply_comment, %{
                viewer_has_upvoted: Enum.member?(reply_comment.meta.upvoted_user_ids, user.id)
              })
            end)

          Map.merge(comment, %{
            viewer_has_upvoted: Enum.member?(comment.meta.upvoted_user_ids, user.id),
            replies: replies
          })
        end
      )

    Map.merge(paged_comments, %{entries: entries})
  end

  @spec get_parent_comment(Comment.t()) :: Comment.t()
  def get_parent_comment(%Comment{reply_to_id: nil} = comment), do: comment

  def get_parent_comment(%Comment{root_comment_id: root_id} = comment) when not is_nil(root_id) do
    # 使用 root_comment_id 直接获取根评论，避免递归查询
    case FrontDesk.get(Comment, root_id) do
      {:ok, root_comment} -> root_comment
      _ -> comment
    end
  end

  def get_parent_comment(%Comment{reply_to_id: reply_to_id} = comment)
      when not is_nil(reply_to_id) do
    # 兼容旧数据，当 root_comment_id 为 nil 时，回退到递归查询
    get_parent_comment(Repo.preload(comment.reply_to, reply_to: :author))
  end
end
