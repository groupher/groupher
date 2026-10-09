defmodule GroupherServerWeb.Schema.CMS.Mutations.Comment do
  @moduledoc """
  GraphQL mutations for comment creation, moderation, and reactions.

  Business position:

      Client
        -> Absinthe schema / Comment
        -> resolver or domain context
        -> GraphQL response
  """
  use Helper.GqlSchemaSuite

  object :cms_comment_mutations do
    @desc "write a comment"
    field :create_comment, :article_comment_result do
      arg(:article, non_null(:article_path_input))
      arg(:body, non_null(:string))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, {:article, preload: [[author: :user], :community]})
      resolve(&R.CMS.Comments.create_comment/3)
      middleware(M.Analysis.MakeContribution, for: :user)
    end

    @desc "update a comment"
    field :update_comment, :article_comment_result do
      arg(:comment, non_null(:comment_path_input))
      arg(:body, non_null(:string))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      middleware(M.Passport, action: "comment.update")

      resolve(&R.CMS.Comments.update_comment/3)
    end

    @desc "delete a comment"
    field :delete_comment, :article_comment_result do
      arg(:comment, non_null(:comment_path_input))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      middleware(M.Passport, action: "comment.delete")

      resolve(&R.CMS.Comments.delete_comment/3)
    end

    @desc "reply to a comment"
    field :reply_comment, :article_comment_result do
      arg(:comment, non_null(:comment_path_input))
      arg(:body, non_null(:string))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.reply_comment/3)
      middleware(M.Analysis.MakeContribution, for: :user)
    end

    @desc "upvote to a comment"
    field :upvote_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.upvote_comment/3)
    end

    @desc "undo upvote to a comment"
    field :undo_upvote_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.undo_upvote_comment/3)
    end

    @desc "report a comment"
    field :report_comment, :comment do
      arg(:command_id, non_null(:id))
      arg(:comment, non_null(:comment_path_input))
      arg(:reason, non_null(:string))
      arg(:attr, :string)

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.report_comment/3)
    end

    @desc "undo report a comment"
    field :undo_report_comment, :comment do
      arg(:command_id, non_null(:id))
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.undo_report_comment/3)
    end

    @desc "emotion to a comment"
    field :emotion_to_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:emotion, non_null(:comment_emotion))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.emotion_to_comment/3)
    end

    @desc "undo emotion to a comment"
    field :undo_emotion_to_comment, :comment do
      arg(:comment, non_null(:comment_path_input))
      arg(:emotion, non_null(:comment_emotion))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.undo_emotion_to_comment/3)
    end

    @desc "accept a comment as a QA post's current solution"
    field :accept_solution, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.accept_solution/3)
    end

    @desc "revoke a comment when it is a QA post's current solution"
    field :revoke_solution, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      resolve(&R.CMS.Comments.revoke_solution/3)
    end

    @desc "pin a comment"
    field :pin_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      middleware(M.Passport, action: "comment.pin")

      resolve(&R.CMS.Comments.pin_comment/3)
    end

    @desc "undo pin a comment"
    field :undo_pin_comment, :comment do
      arg(:comment, non_null(:comment_path_input))

      middleware(M.Authorize, :login)
      middleware(M.FrontDesk, :comment)
      middleware(M.Passport, action: "comment.undo_pin")

      resolve(&R.CMS.Comments.undo_pin_comment/3)
    end
  end
end
