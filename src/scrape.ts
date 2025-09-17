import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import pLimit from 'p-limit';
import { logger, buildErrorReport } from './utils/logger.js';
import { ScrapedArticle, ArticleMeta } from './types.js';

type SelectorCandidate = string[];

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const createHttpClient = (): AxiosInstance => {
  const client = axios.create({
    timeout: 15000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });

  axiosRetry(client, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    shouldResetTimeout: true,
    retryCondition: (error) => {
      const status = error.response?.status;
      return !!status && status >= 500;
    },
    onRetry: (count, error) => {
      logger.warn(`Retrying request (${count})`, error?.message ?? error);
    },
  });

  return client;
};

const http = createHttpClient();
const limit = pLimit(4);

const findFirstMatches = ($: cheerio.CheerioAPI, candidates: SelectorCandidate) => {
  for (const selector of candidates) {
    const nodes = $(selector);
    if (nodes.length > 0) return nodes;
  }
  return $([]);
};

const absoluteUrl = (base: string, href?: string): string => {
  if (!href) return base;
  if (href.startsWith('http')) return href;
  return new URL(href, base).toString();
};

const text = ($el: cheerio.Cheerio<any>) => $el.text().trim();

const parseDate = (input: string): string => {
  const cleaned = input.replace(/\./g, '-').replace(/\s+/g, ' ').trim();
  const knownFormats = ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss'];

  for (const format of knownFormats) {
    const parsed = dayjs(cleaned, format, true);
    if (parsed.isValid()) return parsed.toISOString();
  }

  const fallback = dayjs(cleaned);
  return fallback.isValid() ? fallback.toISOString() : dayjs().toISOString();
};

const fetchHtml = async (url: string) => {
  const { data } = await http.get<string>(url, { responseType: 'text' });
  return data;
};

type ListItem = ArticleMeta;

const scrapeKactaList = async (): Promise<ListItem[]> => {
  const baseUrl = 'https://webzine.kacta.or.kr/';
  const html = await fetchHtml(baseUrl);
  const $ = cheerio.load(html);

  const items: ListItem[] = [];

  // 다양한 섹션에서 기사 수집
  const selectors = [
    '#skin-3 .item a', // 메인 기사
    '#skin-11 .item a', // 일반 기사들
    '#skin-12 .item a',
    '#skin-13 .item a',
    '#skin-14 .item a',
    '#skin-15 .item a',
    '#skin-16 .item a',
    '#skin-17 .item a', // 많이 본 뉴스
    '#skin-19 .item a', // 오피니언
    '#skin-20 .item a', // 회무
    '#skin-21 .item a', // 조세뉴스
    '#skin-23 .item a', // People
    '#skin-24 .item a', // 사회경제
  ];

  for (const selector of selectors) {
    const links = $(selector);
    links.each((_, el) => {
      const link = $(el);
      const title = text(link.find('H2, h2, .auto-titles'));
      if (!title) return;
      
      const href = link.attr('href');
      if (!href || !href.includes('articleView.html')) return;
      
      const url = absoluteUrl(baseUrl, href);
      
      // 중복 제거
      if (items.some(item => item.url === url)) return;
      
      // 섹션 추출 (URL에서 추출하거나 기본값 사용)
      let section = '일반';
      if (href.includes('sc_section_code=S1N1')) section = '회무';
      else if (href.includes('sc_section_code=S1N2')) section = '세정';
      else if (href.includes('sc_section_code=S1N5')) section = '기획';
      else if (href.includes('sc_section_code=S1N6')) section = 'People';
      else if (href.includes('sc_section_code=S1N7')) section = '오피니언';
      else if (href.includes('sc_sub_section_code=S2N1')) section = '조세뉴스';
      else if (href.includes('sc_sub_section_code=S2N2')) section = '사회경제';

      // 최근 7일 이내의 기사만 수집 (오늘부터 7일 전까지)
      const publishedAt = dayjs().toISOString();
      
      items.push({
        title,
        url,
        publishedAt,
        section,
        site: '세무사신문',
      });
    });
  }

  return items.slice(0, 30);
};

const scrapeKactaContent = async (meta: ArticleMeta): Promise<ScrapedArticle | null> => {
  try {
    const html = await fetchHtml(meta.url);
    const $ = cheerio.load(html);
    
    // 실제 발행일 추출
    let publishedAt = meta.publishedAt;
    const publishedTime = $('meta[property="article:published_time"]').attr('content');
    if (publishedTime) {
      publishedAt = dayjs(publishedTime).toISOString();
    }
    
    // 다양한 본문 셀렉터 시도
    const body = findFirstMatches($, [
      '#article-view-content-div',
      '.article-veiw-body',
      '.view_con',
      '.board_view .content',
      '#contentDetail',
      '.article-content',
      '.content',
      '.article-body',
      'article',
      '.view_content',
    ]);

    const paragraphs = body
      .find('p, li, div')
      .map((_, el) => text($(el)))
      .get()
      .filter((line) => line.length > 10); // 최소 길이 필터링

    const content = paragraphs.join('\n');

    if (!content || content.length < 50) return null; // 최소 내용 길이 확인

    return {
      ...meta,
      content,
      publishedAt,
    };
  } catch (error) {
    logger.error(buildErrorReport('세무사신문 본문 추출 실패', error));
    return null;
  }
};

const scrapeNomuList = async (): Promise<ListItem[]> => {
  const baseUrl = 'https://nomu4.net/';
  const html = await fetchHtml(baseUrl);
  const $ = cheerio.load(html);
  const items: ListItem[] = [];

  // 다양한 섹션에서 기사 수집
  const selectors = [
    '.section1-slider li a', // 실시간 뉴스
    '.section2-slider li a', // 헤드라인 뉴스
    '.section2-left-list li a', // 중요뉴스
    '.section2-right-list li a', // 최신뉴스
    '.section4-slider li a', // 영상뉴스
    '.section5-left-item a', // 노무사뉴스
    '.section5-right-list li a', // 오피니언
    '.section6-slider-inner li a', // 사무실알리기
    '.section7-item a', // 각종 콘텐츠
  ];

  for (const selector of selectors) {
    const links = $(selector);
    links.each((_, el) => {
      const link = $(el);
      const title = text(link.find('h4, h5, h6, .section2-slider-tit, .section4-slider-title, .section5-left-item-sub-tit, .section5-right-tit, .section7-item-main-tit'));
      if (!title) return;
      
      const href = link.attr('href');
      if (!href || !href.includes('view.php')) return;
      
      const url = absoluteUrl(baseUrl, href);
      
      // 중복 제거
      if (items.some(item => item.url === url)) return;
      
      // 섹션 추출
      let section = '일반';
      if (selector.includes('section1')) section = '실시간뉴스';
      else if (selector.includes('section2-slider')) section = '헤드라인뉴스';
      else if (selector.includes('section2-left')) section = '중요뉴스';
      else if (selector.includes('section2-right')) section = '최신뉴스';
      else if (selector.includes('section4')) section = '영상뉴스';
      else if (selector.includes('section5-left')) section = '노무사뉴스';
      else if (selector.includes('section5-right')) section = '오피니언';
      else if (selector.includes('section6')) section = '사무실알리기';
      else if (selector.includes('section7')) section = '노동법콘텐츠';

      // 최근 7일 이내의 기사만 수집 (오늘부터 7일 전까지)
      const publishedAt = dayjs().toISOString();
      
      items.push({
        title,
        url,
        publishedAt,
        section,
        site: '노무사신문',
      });
    });
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
};

const scrapeNomuContent = async (meta: ArticleMeta): Promise<ScrapedArticle | null> => {
  try {
    const html = await fetchHtml(meta.url);
    const $ = cheerio.load(html);

    // 실제 발행일 추출
    let publishedAt = meta.publishedAt;
    const dateText = $('.article-head-info .info-text li').last().text().trim();
    if (dateText && dateText.includes('등록')) {
      const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
      if (dateMatch) {
        publishedAt = dayjs(dateMatch[1]).toISOString();
      }
    }

    // 다양한 본문 셀렉터 시도
    const body = findFirstMatches($, [
      '.fr-view',
      '.view_content',
      '.board_view .cont',
      '#bo_v_con',
      '.article-content',
      '.content',
      '.article-body',
      'article',
      '.view_con',
    ]);

    const textBlocks = body
      .find('p, li, div')
      .map((_, el) => text($(el)))
      .get()
      .filter((line) => line.length > 10); // 최소 길이 필터링

    const content = textBlocks.join('\n');

    if (!content || content.length < 50) return null; // 최소 내용 길이 확인

    return {
      ...meta,
      content,
      publishedAt,
    };
  } catch (error) {
    logger.error(buildErrorReport('노무사신문 본문 추출 실패', error));
    return null;
  }
};

const enrichContent = async (metas: ArticleMeta[], fetcher: (meta: ArticleMeta) => Promise<ScrapedArticle | null>) => {
  const tasks = metas.map((meta) =>
    limit(async () => {
      const article = await fetcher(meta);
      return article;
    }),
  );

  const results = await Promise.all(tasks);
  return results.filter((item): item is ScrapedArticle => Boolean(item));
};

export const scrapeArticles = async (): Promise<ScrapedArticle[]> => {
  logger.info('세무사신문 목록 수집 시작');
  const [kactaList, nomuList] = await Promise.all([scrapeKactaList(), scrapeNomuList()]);
  logger.info('세무사신문 목록 수집 완료', { count: kactaList.length });
  logger.info('노무사신문 목록 수집 완료', { count: nomuList.length });

  const [kactaArticles, nomuArticles] = await Promise.all([
    enrichContent(kactaList, scrapeKactaContent),
    enrichContent(nomuList, scrapeNomuContent),
  ]);

  logger.info('세무사신문 본문 추출 완료', { count: kactaArticles.length });
  logger.info('노무사신문 본문 추출 완료', { count: nomuArticles.length });

  return [...kactaArticles, ...nomuArticles];
};
