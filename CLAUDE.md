# class-games 작업 안내

통합과학2(2022 개정) 「환경과 에너지」 수업용 게임 모음. 사용자는 고등학교 과학 교사이고, 학생은 고1이다. 화면 문구와 커밋 메시지는 한국어로 쓴다.

## 구조 원칙
- 빌드 단계 없음. `public/`이 그대로 Firebase Hosting에 올라간다.
- 각 게임은 클래식 `<script>` 순서로 로드: `/vendor/three.min.js` → `engine.js` → 3D 모듈 → `app.js`. 모듈 간 연결은 전역 상수·함수(`const`/`function` 최상위 선언)로 한다. ES 모듈로 바꾸지 않는다.
- `engine.js`는 DOM을 쓰지 않는 순수 규칙 파일이고 맨 끝 `module.exports`로 Node 테스트에 노출된다. 새 함수를 만들면 export 목록에도 추가한다.
- 혼자 하기 모드 상태는 `localStorage`. 200년 생존기 수업 모드는 Firebase Realtime Database(`rooms/수업코드/...`)를 쓰고, 진행 계산은 교사 화면(live.js의 advanceStage)만 한다. 학생은 자기 uid 아래(players·votes·quiz·abil·prep)만 쓴다 — 데이터 구조를 바꾸면 `database.rules.json`도 함께 고친다. 교사는 관리자(`TEACHER_EMAILS`, 규칙에도 같은 주소)가 `teachers/{이메일 키}`에 등록하고(키는 소문자, `.`→`,`), 수업은 `meta/owner`(uid)인 교사만 쓴다. 규칙을 바꾸면 `tests/rules/rules.test.mjs`도 고친다(CI에서 에뮬레이터로 실행).
- 수업 모드 시험: 주소에 `?local`을 붙이면 한 브라우저 여러 탭으로 교사·전자칠판·학생을 띄울 수 있다.
- Three.js는 r128 고정(`public/vendor`). API를 쓸 때 r128 기준으로 확인한다.

## 수정할 때
- `npm test` 통과를 확인한다. 밸런스 테스트: 200년 생존기(20세대) 혼자 하기는 저배출 생존율 ≥90%, 고배출 ≤15%. 수업 모드(`tests/sim.js`, 다수결·특임대·과학 무전 포함, 기습 재난 없음)는 6모둠 기준 저배출 5모둠 이상, 중간 3~4모둠, 고배출 1모둠 정도. `node tests/sim.js`로 현재 수치를 볼 수 있다.
- 파일을 추가·이름 변경하면 `public/sw.js`의 `CORE` 목록을 고치고 `VERSION`을 올린다(테스트가 목록 파일 존재를 검사).
- 휴대폰 세로(약 400px)와 노트북 가로 둘 다 확인한다. 가로 스크롤이 생기면 안 된다.
- 과학 내용(사실·수치)은 출처를 확인하고 바꾼다. 교과 용어는 교과서 표기(메테인, 이산화 탄소, 복사 평형 등)를 따른다.

## 배포
- `main` 푸시 → `.github/workflows/firebase-hosting-merge.yml`이 테스트 후 Hosting과 Realtime Database 규칙을 배포. 비밀 값 `FIREBASE_SERVICE_ACCOUNT`, 프로젝트 ID는 `.firebaserc`.
