# 통합과학 수업 게임

통합과학2 「Ⅱ. 환경과 에너지」 단원 수업용 웹 게임 모음입니다. 휴대폰·태블릿·노트북 브라우저에서 바로 실행되고, 홈 화면에 앱으로 설치할 수 있습니다(PWA).

| 게임 | 단원 | 형식 |
|---|---|---|
| [에너지 도시 경영](public/energy-city/) | 02 발전과 신재생 에너지 · 전기 에너지의 생산과 수송 | 모둠 2차시 · 3D 도시 · 6년 경영 |
| [200년 생존기](public/century/) | 03 온실 효과와 지구 온난화 | 반 전체 실시간 약 25분 · 교사·전자칠판·학생 휴대폰 · 60초 준비 + 20세대 다수결 · 기후 정상 회의 · 모둠 간 지원 · 긴급 구조 · 개인 점수 |
| [자석 브레이크 놀이공원](public/magnet-park/) | 02 발전과 신재생 에너지 · 전자기 유도와 에너지 전환 | 반 전체 실시간 약 30분 · 학생마다 휴대폰, 모둠원이 공원 자리를 나눠 설계 · 자석 브레이크(유도 전류)·발전 코일·흔들어 충전 · 혼자 하기도 가능 |

두 게임 모두 교사 화면이 있습니다(사건 공개, 결과 코드 검증·집계, 개념 정리).

### 200년 생존기 수업 모드
- 교사: `/century/#teacher` → Google 로그인(등록된 교사 계정) → 수업 만들기 → 전자칠판 화면 열기
- 전자칠판: `/century/#board/수업코드` — 모둠별 3D 서식지, 특임대·기습 이벤트 공지, 과학 무전, 엔딩 비교
- 학생: QR(`/century/#join/수업코드`) → 이름·모둠 선택 → 선택지·퀴즈 투표(모둠 다수결), 특임대 능력
- 진행 엔진은 교사 화면에서 돈다. 수업 중에는 교사 화면 탭을 닫지 않는다.
- 주소 끝에 `?local`을 붙이면 Firebase 없이 한 기기의 여러 탭으로 시험할 수 있다(예: `/century/?local#teacher`).
- 교사 계정 추가: 관리자(kjm140@gw1.kr)가 교사 화면 '새 수업 만들기' 아래 **교사 관리** 칸에 Google 계정 이메일을 넣는다. 등록한 교사는 자기 수업만 열고 진행할 수 있다(`rooms/코드/meta/owner`).
- 관리자 주소를 바꿀 때만 `public/shared/firebase-config.js`의 `TEACHER_EMAILS`와 `database.rules.json`의 이메일을 함께 고친다.
- 보안 규칙 테스트(`tests/rules/`)는 Firebase 에뮬레이터가 필요해 GitHub Actions에서 돈다.

### 자석 브레이크 놀이공원 수업 모드
- 교사: `/magnet-park/#teacher` → 수업 만들기(모둠 수·영업일·설계 시간) → 전자칠판 열기 → 학생이 다 들어오면 「1일째 설계 시작」
- 전자칠판: `/magnet-park/#board/수업코드` — 모둠별 3D 공원, 사건 공지, 영업 결과, 퀴즈, 최종 순위·특별상
- 학생: QR(`/magnet-park/#join/수업코드`) → 이름·모둠. 설계 시작 순간의 모둠원끼리 자리 6곳을 나눠 맡고(들어온 순서 첫 학생이 에너지 팀장=계약 전력), 모둠 돈은 함께 쓴다. 흔들어 충전은 모둠원 평균, 퀴즈 보너스는 150만원×정답 비율
- 하루 진행: 설계 → 영업 → 결과 → 과학 퀴즈 → 정답. 모두 「내 설계 완료」를 누르면 5초 뒤 영업 시작
- 설계 변인: 높이·좌석(칸), 차체(강철/알루미늄 합금), 출발 방식(끌어올리기/전자기 발사), 롤러코스터 수직 루프(v² ≥ g·r), 자석 세기·줄 수, 브레이크 구간, 판 재질·두께, 자석–판 간격, 발전 코일, 놀이기구 이름
- 재미 요소: 날마다 「오늘의 의뢰」 2개(보너스, `engine.js`의 `MISSIONS`), 손님 한마디, 인기 별점(12점), 전자칠판 반 기록판(최고 속도·높이·인기·루프)

## 폴더 구조

```
public/                 Firebase Hosting으로 그대로 배포되는 폴더 (빌드 과정 없음)
  index.html, hub.css   첫 화면(게임 모음)
  manifest.webmanifest  앱 설치 정보
  sw.js                 오프라인 캐시(서비스 워커)
  shared/pwa.js         서비스 워커 등록 · 설치 버튼
  shared/net.js         실시간 연결(Firebase Realtime Database / 로컬 모드)
  shared/firebase-config.js  Firebase 웹 설정 · 관리자 이메일
  vendor/three.min.js   Three.js r128 (학교망에서 CDN이 막혀도 동작하도록 내장)
  energy-city/          에너지 도시 경영
    engine.js           게임 규칙(순수 함수, Node 테스트 가능)
    city3d.js           3D 도시
    app.js, style.css   화면
  century/              100년 생존기
    engine.js           동물·사건(1920~2110년대)·시나리오·퀴즈·특임대·기습 이벤트와 규칙
    world3d.js          3D 서식지 + 60초 준비 아레나
    board3d.js          전자칠판: 모둠별 서식지를 한 캔버스에 나눠 그리기
    live.js             수업 모드(교사·전자칠판·학생)
    app.js, style.css   화면
tests/                  node:test 테스트 (규칙·밸런스·파일 참조)
```

## 내 컴퓨터에서 실행

```bash
npm start      # http://localhost:5173 (Python 3 필요)
npm test       # 엔진·밸런스·파일 참조 테스트
```

## 배포

`main`에 푸시하면 GitHub Actions가 테스트를 돌린 뒤 Firebase Hosting(https://class-games-559fd.web.app)에 배포합니다. Pull Request에는 7일짜리 미리보기 주소가 달립니다.

### Firebase 연결 (처음 한 번)

1. 프로젝트 ID `class-games-559fd`는 `.firebaserc`에 들어 있습니다.
2. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성**으로 JSON을 받습니다.
   (또는 PC에서 `firebase init hosting:github`를 실행하면 자동으로 만들어집니다. 이때 생기는 비밀 값 이름이 `FIREBASE_SERVICE_ACCOUNT_<프로젝트ID>`이면 아래 이름으로 하나 더 등록하세요.)
3. GitHub 저장소 → Settings → Secrets and variables → Actions → **New repository secret**
   이름 `FIREBASE_SERVICE_ACCOUNT`, 값에 JSON 전체를 붙여 넣습니다.

비밀 값이 없으면 배포 단계는 경고만 남기고 건너뜁니다.

## 내용 수정

- 200년 생존기 사건·선택지·과학 노트: `public/century/engine.js`의 `ANIMALS`(미래), `HISTORY`(1930~2010년대), `NOW`(2020년대)
- 특임대 역할: `ROLES`, 기습 이벤트: `SURPRISES`
- 과학 무전 퀴즈: `public/century/engine.js`의 `QUIZ`
- 에너지 도시 발전소·사건·퀴즈: `public/energy-city/engine.js`
- 수치를 바꾼 뒤에는 `npm test`로 밸런스 테스트를 확인하세요.

기온·CO₂ 값은 IPCC AR6 SSP 시나리오(SSP1-2.6, SSP2-4.5, SSP5-8.5)를 단순화한 근사값입니다.
