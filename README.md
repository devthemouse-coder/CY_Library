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


## 개발방법
 - 목적 : 내가 읽은 책 목록을 입력하고 확인하여 이후에 도서관에서 책을 빌릴때 참고하기 위함.
 AI를 사용해서 개발함. 초기에는 GPT 5.2 이후에는 Claude Sonnet 4.6 을 주로 사용
 서버가 없는 상태로 개발해야 하며, 안정적인 호스팅이 되어야 하여
 github 와 pages 기능을 사용함.
 이후 key 값 등이 문제가 되어서 해당 설정값등을 저장하기 위하여 github의 Secrets 를 사용함
 사용성은. 모바일 크롬에서 연 다음에 홈바로가기 또는 앱만들기로 사용할 생각을 함
 사용목적이자 최초 사용자가 70대이기 때문에 최대한 편리한 사용방법을 강구함
 입력은 간편하게 할 수 있어야 하며, Books Database 에 없어도 입력이 되어야 한다.
 검색은 쉬운방법으로. 여차하면 한눈에 목록을 볼 수 있어야 한다.

 Naver API 는 서버에서 호출해야 하므로, 클라이언트의 브라우저에서 바로 호출하는경우 문제가 되어 "Cloudflare"의 workers 를 사용. cylibraryserarhbooks.dev-themouse.workers.dev
 worker.js 에 이 소스에 있는 index.js 파일을 그대로 넣음. (dev.themouse@gmail.com)

 