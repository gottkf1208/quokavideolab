# 쿼카 비디오랩 — 클로드가 알아야 할 것

선생님(두목쿼카)이 쓰는 교육영상 편집기. **선생님은 화면에서 다듬고, 클로드는 무거운 일을 맡는다.** 둘은 같은 폴더의 편집 설계도로 이어진다.

## 구조
- 정적 웹앱(빌드 없음, ES 모듈). GitHub Pages(`gottkf1208.github.io/quokavideolab/`)로 배포. 모션랩(`/quoka-motion-lab/`)과 같은 주소라 iframe으로 `quokaLab`을 부른다.
- `js/stage.js` 무대: 설계도 + 시간 t → 한 장면. 편집 화면·완성 미리보기·렌더가 모두 이 무대 하나를 쓴다(그래서 똑같이 나온다).
- `js/codeanim.js` 코드 애니 가상 시계(performance.now·Date·rAF·타이머·getAnimations). `js/motionlab.js` 모션랩 연결. `js/bling.js` 블링 질감·반짝임(같은 t면 같은 그림). `js/bars.js` 자막바 틀.
- `render/render.mjs` 영상 뽑기: `index.html?render=1&project=…&frames=…`를 Playwright로 열어 `__qv.seek(t)` → 스크린샷 → ffmpeg. 장면 영상은 낱장으로 풀어 `<img>`로.

## 선생님이 '클로드에게 넘기기'를 누르면
폴더에 `quokavideolab.json`(설계도)과 `클로드에게.md`(할 일)가 생긴다. 처리 순서:
1. 설계도를 읽고 `memos`에서 `done: false`인 것을 처리한다.
2. 만든 결과물(목소리 wav, 새 영상, 자막바 PNG 등)은 같은 폴더에 넣고 `assets`·`tracks`에 반영한다.
3. 처리한 메모는 `done: true`. 설계도를 저장하면 선생님이 편집기에서 새로고침해 이어서 다듬는다.

자주 오는 메모
- `[영상 뽑기]` → `node render/render.mjs 폴더/quokavideolab.json` (클라우드에서는 `QV_PLAYWRIGHT`·`QV_UNDICI` 경로 지정). 검수: 길이·프레임 수·LUFS(-16)·피크(-1 dBTP 이하)·장면별 스틸.
- `[새 자막바]` → 그 영상 색·분위기로 자막바를 새로 디자인해 PNG로 넣고 `subStyle.bar = 'image'`, `subStyle.barImage = 에셋 id`. **자막바는 영상마다 다르다.** 나무 자막바는 DMZ 편 전용.
- `[뉴테이크 …]` → 유료. **예상 크레딧을 먼저 알리고 승인받은 뒤** 생성. 지금 계정은 비회원(회원 전용 모델 막힐 수 있음). 목소리는 소리 줄에 `voice: true`로.
- 브루(Vrew) 더빙이 필요하면 quoka-editor 스킬의 브루 절차를 따른다.

## 디자인 원칙
- 블링블링 OK(반짝이·홀로그램·하트 전구·네온). 납작한 파스텔 그라데이션·촌스러운 꽉 찬 상자는 피한다.
- 이미지 생성 등 유료 크레딧은 아껴 쓴다. 질감은 코드로 그린다.
- 학생 얼굴·개인정보 금지. 사실 카드는 출처·연도.
