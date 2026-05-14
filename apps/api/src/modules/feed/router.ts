import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  addReaction,
  createComment,
  createPost,
  deletePost,
  getComments,
  getPost,
  listPosts,
  removeReaction,
  savePost,
  unsavePost,
  updatePost,
  votePoll,
} from './controller'
import {
  CreateCommentSchema,
  CreatePostSchema,
  PaginationQuerySchema,
  PollVoteSchema,
  PostListQuerySchema,
  ReactionSchema,
  UpdatePostSchema,
} from './schema'

export const feedRouter = Router()
export const pollsRouter = Router()

feedRouter.use(requireAuth, resolveUniversity)

feedRouter.get('/', validateRequest({ query: PostListQuerySchema }), listPosts)
feedRouter.post('/', validate(CreatePostSchema), createPost)
feedRouter.get('/:postId', getPost)
feedRouter.patch('/:postId', validate(UpdatePostSchema), updatePost)
feedRouter.delete('/:postId', deletePost)
feedRouter.post('/:postId/reactions', validate(ReactionSchema), addReaction)
feedRouter.delete('/:postId/reactions', removeReaction)
feedRouter.get('/:postId/comments', validateRequest({ query: PaginationQuerySchema }), getComments)
feedRouter.post('/:postId/comments', validate(CreateCommentSchema), createComment)
feedRouter.post('/:postId/poll/vote', validate(PollVoteSchema), votePoll)
feedRouter.post('/:postId/save', savePost)
feedRouter.delete('/:postId/save', unsavePost)

pollsRouter.use(requireAuth, resolveUniversity)
pollsRouter.post('/:pollId/vote', validate(PollVoteSchema), votePoll)
