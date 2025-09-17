import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { FilteredArticle } from './types.js';
import { logger, buildErrorReport } from './utils/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const API_BASE = 'https://api.kakaowork.com/v1';
const MAX_LENGTH = 4000;

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
};

const chunkText = (text: string): string[] => {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let buffer: string[] = [];
  let length = 0;

  for (const line of lines) {
    const projected = length + line.length + 1;
    if (projected > MAX_LENGTH && buffer.length > 0) {
      chunks.push(buffer.join('\n'));
      buffer = [line];
      length = line.length + 1;
    } else {
      buffer.push(line);
      length = projected;
    }
  }

  if (buffer.length > 0) {
    chunks.push(buffer.join('\n'));
  }

  return chunks;
};

const buildLinkDigest = (articles: FilteredArticle[]): string => {
  if (articles.length === 0) return '';
  const lines = articles.map((article) => `- ${article.site} | ${article.section ?? '일반'} | [${article.title}](${article.url})`);
  return ['원문 링크', ...lines].join('\n');
};

const buildMessage = (summary: string, articles: FilteredArticle[]): string => {
  const date = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
  const header = `${date} HR/페이롤 아침 브리핑`;
  const linkDigest = buildLinkDigest(articles);
  return [header, summary, linkDigest].filter(Boolean).join('\n\n');
};

const sendByEmail = async (token: string, email: string, text: string) => {
  try {
    await axios.post(
      `${API_BASE}/messages.send_by_email`,
      { email, text },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    logger.info('카카오워크 이메일 전송 성공');
    return true;
  } catch (error) {
    logger.warn(buildErrorReport('카카오워크 이메일 전송 실패', error));
    return false;
  }
};

const sendByConversation = async (token: string, conversationId: string, text: string) => {
  try {
    await axios.post(
      `${API_BASE}/messages.send`,
      { conversation_id: conversationId, text },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    logger.info('카카오워크 대체 전송 성공');
  } catch (error) {
    logger.error(buildErrorReport('카카오워크 대체 전송 실패', error));
    throw error;
  }
};

export const sendToKakaoWork = async (summary: string, articles: FilteredArticle[]) => {
  const token = getRequiredEnv('KWORK_APP_KEY');
  const emailString = getRequiredEnv('KWORK_TO_EMAIL');
  const conversationId = process.env.KWORK_CONVERSATION_ID;

  // 여러 이메일 주소를 쉼표로 분리
  const emails = emailString.split(',').map(email => email.trim()).filter(email => email);

  const message = buildMessage(summary, articles);
  const chunks = chunkText(message);

  for (const chunk of chunks) {
    let allEmailsSent = true;
    
    // 모든 이메일로 전송 시도
    for (const email of emails) {
      const sent = await sendByEmail(token, email, chunk);
      if (!sent) {
        allEmailsSent = false;
        logger.warn(`이메일 전송 실패: ${email}`);
      }
    }
    
    // 모든 이메일 전송이 실패한 경우 대체 전송
    if (!allEmailsSent) {
      if (!conversationId) {
        throw new Error('모든 이메일 전송이 실패했고 KWORK_CONVERSATION_ID가 설정되지 않았습니다');
      }
      await sendByConversation(token, conversationId, chunk);
    }
  }
};
