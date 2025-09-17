# payroll-brief-kakaowork

세무사신문과 노무사신문에서 HR/노무/페이롤 관련 뉴스를 스크래핑해 카카오워크 1:1 메시지로 전달하는 자동화 파이프라인입니다. 매일 오전 06:00(Asia/Seoul)에 GitHub Actions가 실행되어 최신 뉴스를 요약하고 발송합니다.

## 주요 기능
- 세무사신문, 노무사신문 목록 및 본문 스크래핑 (폴백 선택자 포함)
- HR/페이롤 키워드 기반 필터링 및 중복 제거
- Anthropic Claude(`claude-sonnet-4-20250514`)를 이용한 한국어 요약 생성
- 카카오워크 Web API(messages.send_by_email → messages.send)로 요약 전송
- 요약 실패 시 간단한 에러 리포트 전송
- GitHub Actions 스케줄(UTC 21:00 = KST 06:00) 자동 실행

## 요구 사항
- Node.js 20 이상
- Anthropic API Key (Claude)
- 카카오워크 웹 API App Key 및 수신자 이메일

## 설치 방법
```bash
npm install
```

## 환경 변수 설정
`.env` 파일을 생성하고 다음 값을 채웁니다.

```
cp .env.example .env
```

| 변수 | 설명 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic Claude API 키 |
| `ANTHROPIC_MODEL` | 사용할 모델 (기본값 `claude-sonnet-4-20250514`) |
| `KWORK_APP_KEY` | 카카오워크 Web API 앱 키 |
| `KWORK_TO_EMAIL` | 수신자 카카오워크 이메일 |
| `KWORK_CONVERSATION_ID` | `messages.send` 사용 시 대상 대화 ID (옵션) |
| `LOG_LEVEL` | 로그 레벨 (`debug`/`info`/`warn`/`error`) |

## 로컬 실행
1. `npm run build`
2. `node dist/index.js`

실행 시점의 날짜(Asia/Seoul 기준) 기사만 처리합니다.

## 테스트
키워드 필터 화이트리스트/블랙리스트 동작을 확인하려면 다음을 실행합니다.

```bash
npm test
```

## 폴더 구조
```
src/
 ├── filter.ts        # 키워드 필터/중복 제거
 ├── filter.test.ts   # 키워드 테스트
 ├── index.ts         # 파이프라인 오케스트레이터
 ├── scrape.ts        # 사이트별 스크래핑
 ├── send.ts          # 카카오워크 전송 로직
 ├── summarize.ts     # Claude 요약 호출
 ├── types.ts         # 공용 타입 정의
 └── utils/logger.ts  # 단순 콘솔 로거
```

## 스케줄 실행 (GitHub Actions)
`.github/workflows/daily.yml`는 매일 21:00(UTC)에 실행되어 KST 06:00 브리핑을 전송합니다. 필요한 시크릿은 다음과 같습니다.

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (옵션)
- `KWORK_APP_KEY`
- `KWORK_TO_EMAIL`
- `KWORK_CONVERSATION_ID` (옵션)

## 운영 FAQ
- **요약 길이가 너무 길어요.** 필터링 키워드를 조정하거나 기사 수를 제한하세요. 카카오워크 제한(4,000자)을 넘으면 자동으로 여러 메시지로 분할 전송합니다.
- **요약 실패 시 어떻게 되나요?** Anthropic 요청 실패 시 오류 로그와 함께 동일한 경로로 에러 보고를 전송합니다.
- **사이트 구조가 바뀌었어요.** `src/scrape.ts`의 선택자 후보 배열에 새 선택자를 추가하고 배포하세요.
- **대화방으로 받고 싶어요.** `.env` 또는 GitHub 시크릿에 `KWORK_CONVERSATION_ID`를 설정하면 이메일 전송 실패 시 대화방으로 폴백합니다.
