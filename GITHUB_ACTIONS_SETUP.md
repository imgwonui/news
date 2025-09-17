# GitHub Actions 설정 가이드

## 1. GitHub Secrets 설정

GitHub 저장소의 Settings > Secrets and variables > Actions에서 다음 환경변수들을 추가하세요:

- `KWORK_APP_KEY`: 카카오워크 앱 키
- `KWORK_TO_EMAIL`: 수신자 이메일 (쉼표로 구분)
- `KWORK_CONVERSATION_ID`: 카카오워크 대화방 ID (선택사항)
- `ANTHROPIC_API_KEY`: Claude API 키

## 2. 실행 방법

### 자동 실행
- 매일 오전 6시 (한국시간)에 자동으로 실행됩니다
- GitHub Actions 탭에서 실행 로그를 확인할 수 있습니다

### 수동 실행
- GitHub 저장소의 Actions 탭에서 "Daily News Collection" 워크플로우를 선택
- "Run workflow" 버튼을 클릭하여 수동 실행

## 3. 장점

- ✅ 무료 (GitHub Actions 무료 플랜)
- ✅ 안정적 (GitHub 인프라 사용)
- ✅ 로그 확인 가능
- ✅ 수동 실행 가능
- ✅ Vercel Cron Job 제한 없음

## 4. Vercel 배포

Vercel은 이제 수동 실행용 API 엔드포인트로만 사용됩니다:
- `https://your-project.vercel.app/` - POST 요청으로 수동 실행
