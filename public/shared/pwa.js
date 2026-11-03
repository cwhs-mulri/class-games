// 서비스 워커 등록(오프라인 실행)과 "앱으로 설치" 버튼
(function () {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        // 홈 화면 앱은 백그라운드에 오래 남아 있어서, 다시 열 때 새 버전을 확인한다
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
      }).catch(function () {});
    });
  }
  // 게임 목록 화면은 1분 넘게 숨겨져 있다가 다시 보이면 새로 불러온다(새 게임이 바로 보이도록). 게임 진행 화면은 건드리지 않는다
  if (location.pathname === '/' || location.pathname === '/index.html') {
    var hiddenAt = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60000 && navigator.onLine !== false) location.reload();
    });
  }
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    var b = document.getElementById('installBtn');
    if (b) {
      b.hidden = false;
      b.onclick = function () { deferred.prompt(); deferred.userChoice.finally(function () { b.hidden = true; deferred = null; }); };
    }
  });
})();
