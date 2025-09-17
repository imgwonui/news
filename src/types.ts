export interface ArticleMeta {
  title: string;
  url: string;
  publishedAt: string;
  section?: string;
  site: '세무사신문' | '노무사신문';
}

export interface ScrapedArticle extends ArticleMeta {
  content: string;
}

export interface FilteredArticle extends ScrapedArticle {
  tags: string[];
}
