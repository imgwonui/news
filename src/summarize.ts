import Anthropic from '@anthropic-ai/sdk';
import dayjs from 'dayjs';
import { FilteredArticle } from './types.js';
import { logger } from './utils/logger.js';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 마크다운 문법 제거 함수
const removeMarkdown = (text: string): string => {
  return text
    // 굵은 글씨 **text** 또는 __text__ 제거
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // 기울임 *text* 또는 _text_ 제거
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // 헤딩 # ## ### 제거
    .replace(/^#{1,6}\s+/gm, '')
    // 리스트 - * + 제거
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    // 링크 [text](url) 제거
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 코드 `text` 제거
    .replace(/`([^`]+)`/g, '$1')
    // 코드 블록 ``` 제거
    .replace(/```[\s\S]*?```/g, '')
    // 인용 > 제거
    .replace(/^>\s*/gm, '')
    // 수평선 --- 제거
    .replace(/^---+$/gm, '')
    // 빈 줄 정리
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
};

const formatArticleForPrompt = (article: FilteredArticle, index: number): string => {
  const published = dayjs(article.publishedAt).format('YYYY-MM-DD HH:mm');
  const tags = article.tags.length > 0 ? article.tags.join(', ') : '태그 없음';

  return [
    `기사 ${index + 1}`,
    `사이트: ${article.site}`,
    `섹션: ${article.section ?? '미지정'}`,
    `제목: ${article.title}`,
    `발행: ${published}`,
    `키워드: ${tags}`,
    `본문: ${article.content}`,
  ].join('\n');
};

const buildPrompt = (articles: FilteredArticle[]): string => {
  const header = `역할: 한국 HR/세무/노무 담당자에게 보내는 실무 브리핑 작성자\n요구사항:\n- 법/제도 변경, 정부 발표, 판결/행정해석, 실무 영향 강조\n- 급여/원천/4대보험/연말정산 관련 정량 정보(금액/날짜/대상) 보존\n- 각 항목은 5~7줄 이내로 요약하고, 핵심 bullet 1~2개 포함\n- 각 항목마다 '왜 중요한지' 한 줄 포함\n- 사이트/섹션/제목을 명확히 구분하여 표기\n- 불필요한 수식어를 제거하고 간결하게 작성\n- 마크다운 문법 사용 금지 (**, *, #, -, [] 등 사용하지 말 것)\n- 일반 텍스트로만 작성\n- 출력은 한국어\n`;

  const body = articles.map((article, idx) => formatArticleForPrompt(article, idx)).join('\n\n---\n\n');

  return `${header}\n기사 목록:\n${body}`;
};

export const summarizeArticles = async (articles: FilteredArticle[]): Promise<string> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  if (articles.length === 0) {
    return '오늘 전달할 HR/페이롤 관련 기사가 확인되지 않았습니다.';
  }

  const prompt = buildPrompt(articles);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: 0,
      system: '당신은 한국어로 HR/노무 실무 담당자를 위한 요약을 작성하는 전문가입니다. 날짜와 수치를 정확히 유지하세요.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content?.map((item) => ('text' in item ? item.text : '')).join('\n').trim();
    const cleanedContent = content ? removeMarkdown(content) : '요약 생성에 실패했습니다.';
    return cleanedContent;
  } catch (error) {
    logger.error('Anthropic 요약 실패', error);
    throw error;
  }
};
