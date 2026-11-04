defmodule GroupherServer.CMS.Comments.Persist do
  @moduledoc """
  Provides Comment and reply row primitives used by Comments Commands.

      Comments Command
        -> Comments.Persist
        -> Comment and reply rows
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Artiment.BodyBag
  alias CMS.Comments.Numbering
  alias CMS.Model.{Article, Comment, CommentBody, CommentReply, Community, Embeds, PostState}
  alias Helper.{ORM, T}

  @max_parent_replies_count Comment.max_parent_replies_count()
  @default_emotions Embeds.CommentEmotion.default_persisted_emotions()
  @default_comment_meta Embeds.CommentMeta.default_meta()
  @article_cat CMS.Artiment.Const.cat_values() |> Enum.into(%{}, &{&1, &1})

  @doc "Inserts a top-level Comment or reply row after resolving its body and numbering."
  @spec insert_comment(
          String.t(),
          T.thread(),
          atom(),
          Article.t(),
          Community.t(),
          User.t(),
          Comment.t() | nil
        ) :: T.domain_res(Comment.t())
  def insert_comment(
        body,
        thread,
        foreign_key,
        %Article{} = article,
        %Community{} = community,
        %User{id: user_id},
        reply_to_comment \\ nil
      ) do
    stable_article = struct(Article, Map.from_struct(article))

    with {:ok, payload} <- BodyBag.cast(body, thread: :comment),
         {:ok, _article_inner_id} <- article_inner_id(article, community),
         {:ok, inner_id} <- Numbering.next_inner_id(stable_article, foreign_key),
         {:ok, floor} <- Numbering.next_floor(stable_article, foreign_key) do
      attrs = %{
        author_id: user_id,
        emotions: @default_emotions,
        inner_id: inner_id,
        floor: floor,
        is_article_author: user_id == article.author.user.id,
        thread: thread,
        meta: @default_comment_meta,
        root_comment_id: root_comment_id(reply_to_comment)
      }

      attrs = put_comment_identity(attrs, article, foreign_key)

      with {:ok, comment} <- ORM.create(Comment, attrs),
           {:ok, _body} <- insert_body(comment, payload) do
        {:ok, Repo.preload(comment, :body)}
      end
    end
  end

  @doc "Inserts the reply-to association for a newly created reply."
  @spec insert_reply_binding(Comment.t(), Comment.t()) :: T.domain_res(CommentReply.t())
  def insert_reply_binding(%Comment{id: comment_id}, %Comment{id: reply_to_comment_id}) do
    ORM.create(CommentReply, %{
      comment_id: comment_id,
      reply_to_comment_id: reply_to_comment_id
    })
  end

  @doc "Updates the question flag for a newly created Comment."
  @spec update_question_flag(Article.t(), Comment.t()) :: T.domain_res(Comment.t())
  def update_question_flag(%Article{thread: :post, id: article_id}, %Comment{} = comment) do
    question_type = @article_cat.qa

    cat =
      Repo.one(
        from(state in PostState, where: state.article_id == ^article_id, select: state.cat)
      )

    ORM.update(comment, %{is_for_question: cat == question_type})
  end

  def update_question_flag(_article, %Comment{} = comment), do: {:ok, comment}

  @doc "Associates a newly created reply with its parent Comment row."
  @spec associate_reply(Comment.t(), Comment.t()) :: T.domain_res(Comment.t())
  def associate_reply(%Comment{} = replied_comment, %Comment{} = replying_comment) do
    replied_comment
    |> Repo.preload(:reply_to_comment)
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:reply_to_comment, replying_comment)
    |> Repo.update()
  end

  @doc "Updates the bounded embedded replies projection on a parent Comment."
  @spec update_replies_embed(Comment.t(), Comment.t()) :: T.domain_res(Comment.t())
  def update_replies_embed(
        %Comment{replies: replies} = parent_comment,
        %Comment{} = replied_comment
      )
      when length(replies) < @max_parent_replies_count do
    new_replies =
      replies
      |> List.insert_at(length(replies), replied_comment)
      |> Enum.slice(0, @max_parent_replies_count)

    ORM.update_embed(parent_comment, :replies, new_replies)
  end

  def update_replies_embed(%Comment{} = parent_comment, _replied_comment) do
    {:ok, parent_comment}
  end

  @doc "Updates the reply-to-others metadata derived from the parent authors."
  @spec update_reply_to_others_state(Comment.t(), Comment.t(), Comment.t()) ::
          T.domain_res(Comment.t())
  def update_reply_to_others_state(parent_comment, replying_comment, replied_comment) do
    replying_comment = Repo.preload(replying_comment, :author)
    parent_comment = Repo.preload(parent_comment, :author)
    is_reply_to_others = parent_comment.author.id !== replying_comment.author.id

    case is_reply_to_others do
      true ->
        new_meta =
          replied_comment.meta
          |> Map.from_struct()
          |> Map.merge(%{is_reply_to_others: is_reply_to_others})

        ORM.update(replied_comment, %{meta: new_meta})

      false ->
        {:ok, replied_comment}
    end
  end

  @doc "Increments the reply count on a parent Comment."
  @spec increment_replies_count(Comment.t()) :: T.domain_res(Comment.t())
  def increment_replies_count(%Comment{} = parent_comment) do
    ORM.inc(parent_comment, :replies_count)
  end

  @doc "Updates the canonical Comment body using optimistic body versioning."
  @spec update_content(Comment.t(), map(), non_neg_integer()) :: T.domain_res(Comment.t())
  def update_content(%Comment{} = comment, attrs, expected_version) when is_map(attrs) do
    with {:ok, payload} <- BodyBag.cast(attrs, thread: :comment) do
      updates = body_attrs(payload, expected_version + 1) |> Map.to_list()

      case from(body in CommentBody,
             where: body.comment_id == ^comment.id and body.version == ^expected_version
           )
           |> Repo.update_all(set: updates) do
        {1, _} -> {:ok, Repo.preload(comment, :body, force: true)}
        {0, _} -> body_update_error(comment.id)
      end
    end
  end

  @doc "Tombstones a Comment body through the row persistence owner."
  @spec tombstone(Comment.t(), String.t()) :: T.domain_res(Comment.t())
  def tombstone(%Comment{} = comment, delete_hint) do
    json = Jason.encode!([%{"children" => [%{"text" => delete_hint}], "type" => "p"}])

    case Repo.get_by(CommentBody, comment_id: comment.id) do
      %CommentBody{} = body ->
        attrs = %{
          json: json,
          markdown: "#{delete_hint}\n",
          markdown_toc: [],
          html: "<p>#{delete_hint}</p>",
          plain_text: delete_hint,
          digest: delete_hint,
          body_hash: :crypto.hash(:sha256, json) |> Base.encode16(case: :lower),
          schema_version: BodyBag.schema_version(),
          version: body.version + 1
        }

        with {:ok, _body} <- body |> CommentBody.changeset(attrs) |> Repo.update() do
          {:ok, Repo.preload(comment, :body, force: true)}
        end

      nil ->
        {:error, CMS.ErrorCat.comment_body_not_found()}
    end
  end

  defp insert_body(%Comment{} = comment, payload) do
    %CommentBody{}
    |> CommentBody.changeset(body_attrs(payload, 1) |> Map.put(:comment_id, comment.id))
    |> Repo.insert()
  end

  defp body_attrs(payload, version) do
    %{
      json: payload.json,
      markdown: payload.markdown,
      markdown_toc: payload.toc,
      html: payload.html,
      plain_text: payload.plain_text,
      digest: payload.digest,
      body_hash: payload.body_hash,
      schema_version: payload.schema_version,
      version: version
    }
  end

  defp body_update_error(comment_id) do
    case Repo.exists?(from(body in CommentBody, where: body.comment_id == ^comment_id)) do
      true -> {:error, CMS.ErrorCat.comment_body_version_conflict()}
      false -> {:error, CMS.ErrorCat.comment_body_not_found()}
    end
  end

  @doc "Updates the question flag for every Comment under one Post."
  @spec batch_update_question_flag(Article.t(), boolean()) :: {:ok, non_neg_integer()}
  def batch_update_question_flag(%Article{thread: :post} = article, is_question) do
    {count, _rows} =
      from(comment in Comment, where: comment.article_id == ^article.id)
      |> Repo.update_all(set: [is_for_question: is_question])

    {:ok, count}
  end

  defp put_comment_identity(attrs, %{__struct__: Article, id: article_id} = article, :article_id) do
    attrs
    |> Map.put(:article_id, article_id)
    |> Map.put(:branch_id, Map.get(article, :branch_id))
  end

  defp article_inner_id(%Article{} = article, %Community{} = community) do
    with {:ok, %{inner_id: inner_id}} <-
           CMS.Articles.Bindings.get(article, community),
         true <- is_integer(inner_id) do
      {:ok, inner_id}
    else
      _ -> {:error, CMS.ErrorCat.custom("article binding context required")}
    end
  end

  defp article_inner_id(_article, _community) do
    {:error, CMS.ErrorCat.custom("article binding context required")}
  end

  defp root_comment_id(nil), do: nil
  defp root_comment_id(%{root_comment_id: root_id}) when not is_nil(root_id), do: root_id
  defp root_comment_id(%{id: reply_to_comment_id}), do: reply_to_comment_id
end
