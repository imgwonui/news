import { run } from '../src/index';

// Vercel Cron Job용 엔드포인트
export default async function handler(req: any, res: any) {
  // Vercel Cron Job은 GET 요청으로 호출됩니다
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🕕 Cron Job 실행 - 뉴스 수집 및 요약 시작...');
    await run();
    console.log('✅ Cron Job 완료 - 뉴스 수집 및 요약 완료');
    
    res.status(200).json({ 
      success: true, 
      message: '뉴스 수집 및 요약이 완료되었습니다.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Cron Job 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    });
  }
}
