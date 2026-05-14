"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsService = exports.NewsService = void 0;
const db_1 = require("../../config/db");
const socket_1 = require("../../socket");
const errors_1 = require("../../utils/errors");
const logger_1 = require("../../utils/logger");
class NewsService {
    async listNews(context, query) {
        const countQuery = (0, db_1.db)('news').where('university_id', context.universityId);
        if (context.role !== 'admin')
            countQuery.andWhere('is_published', true);
        if (query.category)
            countQuery.andWhere('category', query.category);
        const [{ count }] = await countQuery.count({ count: '*' });
        const total = Number(count);
        const rows = (await newsSelectQuery()
            .where('news.university_id', context.universityId)
            .modify((builder) => {
            if (context.role !== 'admin')
                builder.andWhere('news.is_published', true);
            if (query.category)
                builder.andWhere('news.category', query.category);
        })
            .orderBy('news.is_pinned', 'desc')
            .orderBy('news.published_at', 'desc')
            .orderBy('news.created_at', 'desc')
            .limit(query.limit)
            .offset((query.page - 1) * query.limit));
        return { items: rows.map(toNews), total, page: query.page, limit: query.limit };
    }
    async createNews(context, input) {
        const slug = await uniqueSlug(context.universityId, input.title);
        const [row] = await (0, db_1.db)('news')
            .insert({
            university_id: context.universityId,
            author_id: context.userId,
            title: input.title,
            slug,
            body: input.body,
            cover_url: input.cover_url ?? null,
            category: input.category,
            is_published: input.is_published,
            is_pinned: input.is_pinned,
            published_at: input.is_published ? db_1.db.fn.now() : null,
        })
            .returning('id');
        if (!row)
            throw (0, errors_1.notFound)('News not found', 'NEWS_NOT_FOUND');
        const news = await this.getNews(context, row.id, { incrementView: false });
        if (input.is_published) {
            (0, socket_1.getIo)().to(`uni:${context.universityId}`).emit('news:published', { news });
        }
        return news;
    }
    async getNews(context, newsId, options = { incrementView: true }) {
        const row = await newsSelectQuery()
            .where({ 'news.id': newsId, 'news.university_id': context.universityId })
            .first();
        if (!row || (context.role !== 'admin' && !row.is_published)) {
            throw (0, errors_1.notFound)('News not found', 'NEWS_NOT_FOUND');
        }
        if (options.incrementView !== false) {
            void (0, db_1.db)('news')
                .where({ id: newsId, university_id: context.universityId })
                .increment('view_count', 1)
                .catch((error) => logger_1.logger.warn('Failed to increment news view count', { error, newsId }));
        }
        return toNews(row);
    }
    async updateNews(context, newsId, input) {
        const existing = await (0, db_1.db)('news')
            .select('id', 'author_id', 'is_published', 'title')
            .where({ id: newsId, university_id: context.universityId })
            .first();
        if (!existing)
            throw (0, errors_1.notFound)('News not found', 'NEWS_NOT_FOUND');
        if (context.role !== 'admin' && existing.author_id !== context.userId) {
            throw (0, errors_1.forbidden)('You do not have permission to update this news item', 'NEWS_FORBIDDEN');
        }
        const publishingNow = input.is_published === true && !existing.is_published;
        await (0, db_1.db)('news')
            .where({ id: newsId, university_id: context.universityId })
            .update({
            ...pickDefined({
                title: input.title,
                slug: input.title ? await uniqueSlug(context.universityId, input.title, newsId) : undefined,
                body: input.body,
                cover_url: input.cover_url,
                category: input.category,
                is_published: input.is_published,
                is_pinned: input.is_pinned,
                published_at: publishingNow ? db_1.db.fn.now() : undefined,
            }),
            updated_at: db_1.db.fn.now(),
        });
        const news = await this.getNews({ ...context, role: 'admin' }, newsId, { incrementView: false });
        if (publishingNow) {
            (0, socket_1.getIo)().to(`uni:${context.universityId}`).emit('news:published', { news });
        }
        return news;
    }
    async deleteNews(context, newsId) {
        const existing = await (0, db_1.db)('news')
            .select('author_id')
            .where({ id: newsId, university_id: context.universityId })
            .first();
        if (!existing)
            throw (0, errors_1.notFound)('News not found', 'NEWS_NOT_FOUND');
        if (context.role !== 'admin' && existing.author_id !== context.userId) {
            throw (0, errors_1.forbidden)('You do not have permission to delete this news item', 'NEWS_FORBIDDEN');
        }
        await (0, db_1.db)('news').where({ id: newsId, university_id: context.universityId }).delete();
        return { deleted: true };
    }
}
exports.NewsService = NewsService;
exports.newsService = new NewsService();
function newsSelectQuery() {
    return (0, db_1.db)('news')
        .join('profiles', 'profiles.user_id', 'news.author_id')
        .select('news.id', 'news.university_id', 'news.author_id', 'news.title', 'news.slug', 'news.body', 'news.cover_url', 'news.category', 'news.is_published', 'news.is_pinned', 'news.view_count', 'news.published_at', 'news.created_at', 'news.updated_at', 'profiles.full_name as author_full_name', 'profiles.avatar_url as author_avatar_url', 'profiles.headline as author_headline');
}
async function uniqueSlug(universityId, title, excludeId) {
    const base = slugify(title);
    let slug = base;
    let suffix = 2;
    while (await slugExists(universityId, slug, excludeId)) {
        slug = `${base}-${suffix}`;
        suffix += 1;
    }
    return slug;
}
async function slugExists(universityId, slug, excludeId) {
    const query = (0, db_1.db)('news').where({ university_id: universityId, slug });
    if (excludeId)
        query.whereNot('id', excludeId);
    return Boolean(await query.first());
}
function slugify(value) {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'news';
}
function toNews(row) {
    return {
        id: row.id,
        universityId: row.university_id,
        authorId: row.author_id,
        title: row.title,
        slug: row.slug,
        body: row.body,
        coverUrl: row.cover_url,
        category: row.category,
        isPublished: row.is_published,
        isPinned: row.is_pinned,
        viewCount: row.view_count,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: {
            id: row.author_id,
            fullName: row.author_full_name,
            avatarUrl: row.author_avatar_url,
            headline: row.author_headline,
        },
    };
}
function pickDefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
