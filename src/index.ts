import 'dotenv/config';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { scrapeArticles } from './scrape.js';
import { filterArticles } from './filter.js';
import { summarizeArticles } from './summarize.js';
import { sendToKakaoWork } from './send.js';
import { logger, buildErrorReport } from './utils/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const filterRecent = (isoDate: string) => {
  const target = dayjs(isoDate).tz('Asia/Seoul');
  const now = dayjs().tz('Asia/Seoul');
  const sevenDaysAgo = now.subtract(7, 'day');
  return target.isAfter(sevenDaysAgo) && target.isBefore(now.add(1, 'day'));
};

export const run = async () => {
  try {
    logger.info('파이프라인 시작');
    const scraped = await scrapeArticles();
    const recentArticles = scraped.filter((article) => filterRecent(article.publishedAt));
    logger.info('최근 7일 기사 수집 완료', { scraped: scraped.length, recent: recentArticles.length });

    const filtered = filterArticles(recentArticles);
    logger.info('필터링 결과', { filtered: filtered.length });

    const summary = await summarizeArticles(filtered);
    logger.info('요약 생성 완료');

    await sendToKakaoWork(summary, filtered);
    logger.info('카카오워크 전송 완료');
  } catch (error) {
    const report = buildErrorReport('파이프라인 실패', error);
    logger.error(report);

    if (process.env.KWORK_APP_KEY && process.env.KWORK_TO_EMAIL) {
      try {
        await sendToKakaoWork(`🚨 파이프라인 실패 알림\n\n${report}`, []);
      } catch (sendError) {
        logger.error(buildErrorReport('실패 리포트 전송 실패', sendError));
      }
    }

    process.exitCode = 1;
  }
};

if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'))) {
  run();
}
