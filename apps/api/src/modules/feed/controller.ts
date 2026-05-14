import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized, AppError } from '../../utils/errors'
import { feedService } from './service'
import type {
  CreateCommentInput,
  CreatePostInput,
  PaginationQuery,
  PollVoteInput,
  PostListQuery,
  ReactionInput,
  UpdatePostInput,
} from './schema'

export const listPosts = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await feedService.listPosts(context.universityId, context.userId, req.query as unknown as PostListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const post = await feedService.createPost(context, req.body as CreatePostInput)
  sendSuccess(res, post, 201)
})

export const getPost = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.getPost(context.universityId, context.userId, getPostIdParam(req)))
})

export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.updatePost(context, getPostIdParam(req), req.body as UpdatePostInput))
})

export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.deletePost(context, getPostIdParam(req)))
})

export const addReaction = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.upsertReaction(context, getPostIdParam(req), (req.body as ReactionInput).reaction_type!))
})

export const removeReaction = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.removeReaction(context, getPostIdParam(req)))
})

export const getComments = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await feedService.listComments(
    context.universityId,
    context.userId,
    getPostIdParam(req),
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.createComment(context, getPostIdParam(req), req.body as CreateCommentInput), 201)
})

export const votePoll = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const pollId = getPollIdParam(req)
  const result = pollId
    ? await feedService.votePollByPollId(context, pollId, req.body as PollVoteInput & { poll_option_id: string })
    : await feedService.votePoll(context, getPostIdParam(req), req.body as PollVoteInput & { poll_option_id: string })
  sendSuccess(res, result)
})

export const savePost = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.savePost(context, getPostIdParam(req)), 201)
})

export const unsavePost = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await feedService.unsavePost(context, getPostIdParam(req)))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  if (!req.university) throw new AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED')

  return {
    userId: req.user.userId,
    universityId: req.university.id,
    role: req.user.role,
  }
}

function getPostIdParam(req: Request) {
  const value = req.params.postId
  return Array.isArray(value) ? value[0] : value
}

function getPollIdParam(req: Request) {
  const value = req.params.pollId
  return Array.isArray(value) ? value[0] : value
}
