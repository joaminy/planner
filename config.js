/* ================================================================
   [설정 파일] Firebase 연결 정보  ―  이 파일 하나만 고치면 됩니다
   ----------------------------------------------------------------
   1) Firebase 콘솔에서 복사한 코드 가운데
          const firebaseConfig = {
            apiKey: "....",
            ...
          };
      부분만 골라 복사합니다. (중괄호 { } 와 끝의 ; 까지 포함)

   2) 아래의  const firebaseConfig = { ... };  부분을
      통째로 지우고, 복사한 내용을 그 자리에 붙여 넣습니다.

   ※ import 로 시작하는 줄, initializeApp 이 들어간 줄은
     붙여 넣지 마십시오. (붙여 넣으면 앱이 설정 오류를 표시합니다)
   ※ 비워 둔 상태로 열면 '미리보기 모드'(이 기기에만 저장)로 동작합니다.
   ================================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyB9e9ArW4YwR3N5tpxfefaHCnZ28rDCYl0",
  authDomain: "my-planner-3c0e6.firebaseapp.com",
  projectId: "my-planner-3c0e6",
  storageBucket: "my-planner-3c0e6.firebasestorage.app",
  messagingSenderId: "501090571282",
  appId: "1:501090571282:web:a55c405b952ddffebcf4cb"
};

/* ▼▼▼ 이 아래 줄은 고치거나 지우지 마십시오 ▼▼▼ */
window.PLANNER_CONFIG = firebaseConfig;
