# B.CY Library (PWA)

읽은 책 목록을 관리하는 PWA입니다.

## 실행(로컬)

서비스 워커는 `file://`로 열면 동작하지 않을 수 있으니, 로컬 서버로 띄우는 걸 권장합니다.

### Node가 있는 경우

```bash
npx http-server -c-1 -p 5173 .
```

브라우저에서 `http://localhost:5173` 접속 후, Android Chrome에서 **홈 화면에 추가**하면 설치됩니다.

> 참고: 저장 데이터(IndexedDB)는 **접속 주소(Origin)** 별로 분리됩니다.
> 예) `localhost:5173`에 저장한 목록은 `127.0.0.1:5173` 또는 `192.168.x.x:5173`(휴대폰에서 접속)에는 보이지 않을 수 있어요.
> 목록이 “사라진 것처럼” 보이면, **처음 저장했을 때 사용한 주소**로 다시 접속해보세요.

## 1단계 기능

- 읽은 책 CRUD (제목/저자/완독일/메모)
- 검색 가능한 리스트 뷰
- IndexedDB 저장 (기기 내 로컬)

## 2단계(진행중) 기능

- Google Books API로 책 검색
- ISBN 바코드 스캔(지원 기기: Android Chrome + BarcodeDetector API)

## 내보내기/가져오기(로컬 백업)

- 내보내기: 현재 기기(IndexedDB)에 저장된 책 목록을 JSON으로 다운로드합니다.
- 가져오기: JSON을 읽어서 **기존 목록은 유지한 채 추가로만** 저장합니다.
- 중복 방지: 각 책에는 `guid`가 저장되며, 가져오기 시 **같은 `guid`가 이미 있으면 건너뜁니다**.
- (구버전 백업) `guid`가 없는 항목은 `title+authors+finishedAt` 조합으로 중복을 일부 방지합니다.

## AI 요약(선택)

현재 버전은 **Google Gemini(AI Studio) API Key를 코드에 넣어** 요약을 호출합니다.

- 설정 위치: [ai.js](ai.js) 상단의 `GEMINI_API_KEY`
- 보안 주의: 정적 사이트에 키를 넣으면 **누구나 키를 볼 수 있습니다**. 꼭 Google Cloud Console에서 API 키를
	**HTTP referrer(웹사이트) 제한**으로 걸고, 쿼터도 낮게 잡아주세요.
- 참고: `gen-lang-client-...` 같은 문자열은 보통 **API 키가 아니라 식별자**라서 단독으로는 호출이 안 됩니다.
