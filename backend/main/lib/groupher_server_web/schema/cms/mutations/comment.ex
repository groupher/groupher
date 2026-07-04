defmodule GroupherServerWeb.Schema.CMS.Mutations.Comment do
  @moduledoc """
  GraphQL mutations for comment creation, moderation, and reactions.
  """
  use Helper.GqlSchemaSuite

  object :cms_comment_mutations do
    @desc "write a comment"
    field :create_comment, :comment do
      arg(:article, non_null(:article_path_input))
      arg(:body, non_null(:string))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.create_comment/3)
      middleware(M.Statistics.MakeContribute, for: :user)
    end

    @desc "update a comment"
    field :update_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:body, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      middleware(M.Passport, action: "comment.update")

      resolve(&R.CMS.update_comment/3)
    end

    @desc "delete a comment"
    field :delete_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      middleware(M.Passport, action: "comment.delete")

      resolve(&R.CMS.delete_comment/3)
    end

    @desc "reply to a comment"
    field :reply_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:body, non_null(:string))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.reply_comment/3)
      middleware(M.Statistics.MakeContribute, for: :user)
    end

    @desc "upvote to a comment"
    field :upvote_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.upvote_comment/3)
    end

    @desc "undo upvote to a comment"
    field :undo_upvote_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.undo_upvote_comment/3)
    end

    @desc "report a comment"
    field :report_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:reason, non_null(:string))
      arg(:attr, :string)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.report_comment/3)
    end

    @desc "undo report a comment"
    field :undo_report_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.undo_report_comment/3)
    end

    @desc "emotion to a comment"
    field :emotion_to_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:emotion, non_null(:comment_emotion))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.emotion_to_comment/3)
    end

    @desc "undo emotion to a comment"
    field :undo_emotion_to_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:emotion, non_null(:comment_emotion))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.undo_emotion_to_comment/3)
    end

    @desc "mark a comment as question post's best solution"
    field :mark_comment_solution, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.mark_comment_solution/3)
    end

    @desc "mark a comment as question post's best solution"
    field :undo_mark_comment_solution, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.undo_mark_comment_solution/3)
    end

    @desc "pin a comment"
    field :pin_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      middleware(M.Passport, action: "comment.pin")

      resolve(&R.CMS.pin_comment/3)
    end

    @desc "undo pin a comment"
    field :undo_pin_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      middleware(M.Passport, action: "comment.undo_pin")

      resolve(&R.CMS.undo_pin_comment/3)
    end
  end
end
