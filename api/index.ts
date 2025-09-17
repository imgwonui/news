import { run } from '../src/index';

// Vercel에서 호출할 수 있는 API 엔드포인트
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('뉴스 수집 및 요약 시작...');
    await run();
    console.log('뉴스 수집 및 요약 완료');
    
    res.status(200).json({ 
      success: true, 
      message: '뉴스 수집 및 요약이 완료되었습니다.' 
    });
  } catch (error) {
    console.error('오류 발생:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류' 
    });
  }
}
