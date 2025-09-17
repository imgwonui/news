import { describe, expect, it } from 'vitest';
import { filterArticles } from './filter.js';
import { ScrapedArticle } from './types.js';

describe('filterArticles', () => {
  const baseArticle: ScrapedArticle = {
    title: '테스트 기사',
    url: 'https://example.com/article',
    publishedAt: new Date().toISOString(),
    section: '테스트',
    site: '세무사신문',
    content: '본문 텍스트',
  };

  it('includes article when keyword matches', () => {
    const articles = [
      {
        ...baseArticle,
        title: '최저임금 조정 발표',
        content: '정부가 최저임금 변경을 발표했다.',
      },
    ];
    const result = filterArticles(articles);
    expect(result).toHaveLength(1);
    expect(result[0].tags).toContain('최저임금');
  });

  it('excludes article when keyword absent', () => {
    const result = filterArticles([baseArticle]);
    expect(result).toHaveLength(0);
  });

  it('excludes article when blacklist matches', () => {
    const articles = [
      {
        ...baseArticle,
        title: '최저임금 광고',
        content: '광고 이벤트 안내',
      },
    ];
    const result = filterArticles(articles);
    expect(result).toHaveLength(0);
  });
});
