// 서비스 워커 등록(오프라인 실행)과 "앱으로 설치" 버튼
(function () {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
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
