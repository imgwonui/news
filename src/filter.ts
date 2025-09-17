import { z } from 'zod';
import { ScrapedArticle, FilteredArticle } from './types.js';
import { logger } from './utils/logger.js';

const includeKeywords = [
  '휴가',
  '채용',
  '임금',
  '최저임금',
  '통상임금',
  '4대보험',
  '국민연금',
  '건강보험',
  '고용보험',
  '산재보험',
  '원천세',
  '연말정산',
  '소득세',
  '퇴직',
  '근로계약',
  '근로시간',
  '연차',
  '탄력근로',
  '모성보호',
  '출산휴가',
  '육아휴직',
  '산재',
  '노조',
  '단체교섭',
  '해고',
  '징계',
  '근로자',
  'HR',
  '페이롤',
  '세액',
  '공제',
  '상여',
  '수당',
  '복리후생',
  '주52',
  '주 52',
  '노사',
  '법령',
  '행정해석',
];

const includeRegexes = includeKeywords.map((kw) => new RegExp(kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));

const excludeRegexes = [
  /광고/i,
  /이벤트/i,
  /쿠폰/i,
  /구독/i,
  /후기/i,
  /상생페이백/i, // 이 키워드가 제외되고 있음
];

const articleSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.string().min(1),
  section: z.string().optional(),
  site: z.enum(['세무사신문', '노무사신문']),
  content: z.string().min(1),
});

const findTags = (article: ScrapedArticle): string[] => {
  const tags = new Set<string>();
  const haystack = `${article.title}\n${article.content}`;

  includeRegexes.forEach((regex, idx) => {
    if (regex.test(haystack)) {
      tags.add(includeKeywords[idx]);
    }
  });

  return Array.from(tags);
};

const matchesInclude = (article: ScrapedArticle) => {
  const haystack = `${article.title}\n${article.content}`;
  return includeRegexes.some((regex) => regex.test(haystack));
};

const matchesExclude = (article: ScrapedArticle) => {
  const haystack = `${article.title}\n${article.content}`;
  return excludeRegexes.some((regex) => regex.test(haystack));
};

export const filterArticles = (articles: ScrapedArticle[]): FilteredArticle[] => {
  logger.info('필터링 시작', { total: articles.length });
  
  const validated = articles
    .map((article) => {
      const parsed = articleSchema.safeParse(article);
      if (!parsed.success) {
        logger.warn('Invalid article skipped', parsed.error.flatten());
        return null;
      }
      return parsed.data;
    })
    .filter((item): item is ScrapedArticle => Boolean(item));

  logger.info('유효성 검사 완료', { validated: validated.length });

  const unique = new Map<string, ScrapedArticle>();
  validated.forEach((article) => {
    const key = article.url.replace(/#.*/, '');
    if (unique.has(key)) {
      logger.debug('Duplicate article dropped', { url: article.url });
      return;
    }
    unique.set(key, article);
  });

  logger.info('중복 제거 완료', { unique: unique.size });

  const filtered = Array.from(unique.values()).filter((article) => {
    const excluded = matchesExclude(article);
    const included = matchesInclude(article);
    
    // 첫 번째 기사의 내용을 로그로 출력
    if (article.title.includes('세무사회') || article.title.includes('한국조세연구소')) {
      logger.info('기사 내용 샘플', { 
        title: article.title,
        content: article.content.substring(0, 200),
        excluded, 
        included
      });
    }
    
    if (excluded) return false;
    if (!included) return false;
    return true;
  });

  logger.info('키워드 필터링 완료', { filtered: filtered.length });

  return filtered.map((article) => ({
    ...article,
    tags: findTags(article),
  }));
};
