// ===== 100년 생존기 : 게임 엔진 (순수 함수) =====
const GENS = 10;
const DECADES = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100, 2110, 2120];

// IPCC AR6 SSP 시나리오를 단순화한 산업화 이전 대비 기온 상승(°C)과 대기 CO2 농도(ppm) 근사값
const SCENARIOS = {
  low:  { key: 'low',  digit: 1, name: '저배출', code: 'SSP1-2.6', desc: '전 세계가 빠르게 탄소 중립에 도달',
          T: [1.5, 1.6, 1.7, 1.8, 1.8, 1.8, 1.8, 1.7, 1.7, 1.6], ppm: [440, 450, 450, 445, 435, 425, 415, 405, 395, 385] },
  mid:  { key: 'mid',  digit: 2, name: '중간 배출', code: 'SSP2-4.5', desc: '지금의 정책을 이어 가는 경로',
          T: [1.5, 1.7, 2.0, 2.2, 2.4, 2.6, 2.7, 2.8, 2.9, 3.0], ppm: [440, 475, 505, 540, 570, 595, 615, 630, 640, 650] },
  high: { key: 'high', digit: 3, name: '고배출', code: 'SSP5-8.5', desc: '화석 연료 사용이 계속 늘어나는 경로',
          T: [1.6, 2.0, 2.4, 2.9, 3.4, 3.9, 4.4, 4.8, 5.2, 5.6], ppm: [450, 505, 570, 650, 740, 840, 940, 1050, 1150, 1250] },
};
const SCEN_ORDER = ['low', 'mid', 'high'];

// e: 즉시 효과 {pop, energy, health, hab(서식지 보정, 계속 유지), food(먹이 보정, 계속 유지)}
// r: 확률 결과 {p, good:{e,t}, bad:{e,t}}
const ANIMALS = {
  bear: {
    key: 'bear', letter: 'B', name: '북극곰', place: '북극해', habName: '해빙 면적', energyName: '지방 비축', popName: '개체군', healthName: '건강',
    tagline: '얼음이 사라지면 사냥할 발판도 사라진다',
    threat: '해빙 감소 → 사냥 기간 단축',
    sens: { hab: 44, heat: 0, acid: 0 },
    prep: { food: '물범', special: '눈 굴 자리', hazard: '차가운 바다', goal: '얼음 위에서 물범을 사냥해 지방을 모으세요. 해빙은 60초 동안 점점 녹아요. 물속에서는 느려지고 체력이 줄어요. 북쪽 육지의 눈 굴 자리를 찾으면 새끼를 키우기 좋아요.' },
    chain: ['화석 연료 연소', '대기 중 CO₂ 증가', '온실 효과 강화', '북극 기온 상승', '해빙 감소', '사냥 기간 단축', '굶주림 · 번식 실패'],
    intro: { id: 'b0', title: '얼음 위의 봄', text: '물범 사냥철이 시작됐다. 해빙 위 숨구멍 앞에서 몇 시간이고 숨을 죽인다.',
      sci: '북극곰은 바다 위에 떠 있는 얼음(해빙)을 발판 삼아 물범을 사냥한다. 해빙이 줄면 사냥할 수 있는 날도 줄어든다.',
      c: [ { l: '숨구멍 앞에서 끈질기게 기다린다', e: { energy: 10 }, t: '긴 기다림 끝에 물범을 잡았다. 두툼한 지방이 쌓인다.' },
           { l: '얼음 가장자리를 넓게 순찰한다', r: { p: .6, good: { e: { energy: 18 }, t: '가장자리에서 쉬던 물범 두 마리를 잡았다!' }, bad: { e: { energy: -5 }, t: '얇은 얼음이 깨져 헛걸음만 했다.' } } } ] },
    events: [
      [ { id: 'b1', title: '3주 빨라진 해빙 붕괴', text: '올해는 얼음이 예년보다 3주나 일찍 깨졌다. 아직 지방을 충분히 모으지 못했는데.',
          sci: '기온이 오르면 해빙은 더 일찍 녹고 더 늦게 언다. 사냥 기간이 짧아지고 굶는 기간이 길어진다.',
          c: [ { l: '남은 얼음을 따라 북쪽으로 이동한다', e: { energy: -12, hab: 8 }, t: '먼 길이었지만 아직 얼음이 단단한 북쪽에 닿았다.' },
               { l: '육지에 올라가 굶으며 버틴다', e: { energy: -18, health: -5 }, t: '해안의 바위 위에서 몇 달을 굶으며 지방을 태웠다.' },
               { l: '먼 바다까지 헤엄쳐 큰 얼음을 찾는다', r: { p: .5, good: { e: { energy: 15, hab: 5 }, t: '사흘을 헤엄친 끝에 커다란 얼음판을 찾았다!' }, bad: { e: { health: -20, pop: -8 }, t: '얼음은 없었다. 지친 새끼 몇 마리가 바다를 건너지 못했다.' } } } ] },
        { id: 'b2', title: '검게 변한 바다', text: '얼음이 사라진 자리에 검푸른 바다가 드러났다. 바다는 햇빛을 받아 점점 따뜻해진다.',
          sci: '하얀 얼음은 햇빛을 많이 반사하지만(알베도가 높음) 어두운 바다는 햇빛을 흡수한다. 얼음이 녹을수록 더 따뜻해지고, 다시 얼음이 더 녹는 양의 되먹임이 일어난다.',
          c: [ { l: '빙하 그늘의 차가운 만으로 옮긴다', e: { energy: -8, hab: 5 }, t: '빙하가 바다로 흘러드는 차가운 만에는 아직 얼음이 남아 있었다.' },
               { l: '원래 사냥터를 지킨다', e: { energy: 5, hab: -5 }, t: '익숙한 사냥터에서 버텼지만 얼음은 해마다 줄어든다.' } ] },
        { id: 'b3', title: '해안의 새 둥지', text: '굶주린 채 해안을 걷다가 바닷새 둥지 군락을 발견했다.',
          sci: '육지 먹이(새알, 열매)는 물범 지방에 비해 열량이 훨씬 적다. 해빙을 잃은 북극곰을 오래 버티게 해 주지 못한다.',
          c: [ { l: '새알로 배를 채운다', e: { energy: 8 }, t: '알을 실컷 먹었지만 금세 다시 배가 고프다.' },
               { l: '에너지를 아끼려 그늘에서 쉰다', e: { health: 5 }, t: '움직임을 줄여 지방을 아꼈다.' },
               { l: '사람 마을 쓰레기장을 뒤진다', r: { p: .5, good: { e: { energy: 15 }, t: '쓰레기장에서 먹을 것을 찾았다.' }, bad: { e: { pop: -10, health: -10 }, t: '사람들과 마주쳐 쫓겨나고 다쳤다.' } } } ] } ],
      [ { id: 'b4', title: '눈 대신 비', text: '한겨울인데 비가 내렸다. 새끼를 품은 눈 굴의 지붕이 얼었다 녹으며 무너질 것 같다.',
          sci: '북극 기온이 오르면서 눈 대신 비가 내리는 날이 늘었다. 눈 굴이 무너지면 갓 태어난 새끼가 추위에 노출된다.',
          c: [ { l: '굴을 버리고 새 눈더미를 찾는다', e: { energy: -10 }, t: '깊은 눈더미를 찾아 굴을 새로 팠다.' },
               { l: '굴에 그대로 머문다', r: { p: .45, flagP: { den: .8 }, good: { e: { pop: 6 }, t: '굴이 버텨 주었다. 새끼들이 무사히 자랐다.' }, bad: { e: { pop: -15 }, t: '굴이 무너져 새끼를 잃었다.' } } } ] },
        { id: 'b5', title: '늦어지는 결빙', text: '가을이 끝나가는데 바다가 얼지 않는다. 해안에는 굶주린 곰들이 모여든다.',
          sci: '해빙이 어는 시기가 늦어질수록 북극곰이 육지에서 굶어야 하는 기간이 길어진다.',
          c: [ { l: '해안에서 얼음이 얼 때까지 기다린다', e: { energy: -15 }, t: '기다림은 길었다. 지방이 눈에 띄게 줄었다.' },
               { l: '얇은 얼음에 먼저 올라가 본다', r: { p: .5, good: { e: { energy: 20 }, t: '얇은 얼음 위에서 남들보다 먼저 사냥에 성공했다!' }, bad: { e: { health: -20 }, t: '얼음이 깨져 얼음물에 빠졌다.' } } } ] },
        { id: 'b6', title: '물범도 줄었다', text: '해빙 위에서 새끼를 낳는 고리무늬물범이 줄었다. 사냥감 자체가 줄어든다.',
          sci: '해빙 → 물범 → 북극곰으로 이어지는 먹이 사슬에서 아래 단계가 흔들리면 최상위 포식자도 흔들린다.',
          c: [ { l: '바다코끼리 사체 등 다른 먹이를 찾아 멀리 간다', e: { energy: -5, food: 3 }, t: '새로운 먹이터를 기억해 두었다.' },
               { l: '사냥 시간을 늘린다', e: { energy: 5, health: -8 }, t: '쉬지 않고 사냥해 겨우 배를 채웠지만 몸이 지쳤다.' } ] } ],
      [ { id: 'b7', title: '남쪽에서 온 손님', text: '북쪽으로 올라온 회색곰과 마주쳤다. 서식지가 겹치기 시작했다.',
          sci: '기온이 오르면 생물의 분포가 극 쪽과 높은 곳으로 이동한다. 새로운 경쟁자가 들어온다.',
          c: [ { l: '싸우지 않고 물러난다', e: { energy: -8 }, t: '먹이터 일부를 내주었다.' },
               { l: '영역을 지킨다', r: { p: .5, good: { e: { hab: 5 }, t: '회색곰이 물러났다.' }, bad: { e: { health: -20 }, t: '싸움에서 크게 다쳤다.' } } } ] },
        { id: 'b8', title: '녹아내리는 언 땅', text: '해안의 언 땅이 녹아 무너지고, 웅덩이에서 기포가 보글보글 올라온다.',
          sci: '영구 동토층이 녹으면 땅속에 갇혀 있던 메테인(CH₄)이 나온다. 메테인은 강력한 온실 기체라 온난화를 더 빠르게 하는 양의 되먹임이 된다.',
          c: [ { l: '내륙의 단단한 땅으로 피한다', e: { energy: -8, health: 5 }, t: '무너지는 해안을 피해 안전한 곳에 자리를 잡았다.' },
               { l: '해안에 머문다', r: { p: .6, good: { e: { energy: 5 }, t: '해안에 밀려온 먹이를 찾았다.' }, bad: { e: { health: -15 }, t: '무너지는 언덕에 휩쓸렸다.' } } } ] },
        { id: 'b9', title: '얼음 없는 여름', text: '이제 여름이면 해빙이 거의 남지 않는다. 마지막으로 얼음이 오래 남는 바다가 북쪽에 있다고 한다.',
          sci: '여러 해 동안 녹지 않는 두꺼운 다년빙이 빠르게 줄고 있다. 캐나다 북극 제도와 그린란드 북쪽은 얼음이 가장 오래 남을 것으로 예상되는 "마지막 얼음 지역"이다.',
          c: [ { l: '마지막 얼음 지역으로 대이동한다', e: { energy: -20, hab: 12 }, t: '긴 여정 끝에 두꺼운 얼음이 남은 바다에 닿았다.' },
               { l: '익숙한 해안에 남는다', e: { hab: -5 }, t: '익숙한 곳에 남았지만 얼음은 돌아오지 않았다.' } ] } ],
    ],
  },
  penguin: {
    key: 'penguin', letter: 'P', name: '황제펭귄', place: '남극 해안', habName: '정착빙', energyName: '체지방', popName: '번식 군집', healthName: '건강',
    tagline: '새끼가 자랄 때까지 얼음이 버텨 줘야 한다',
    threat: '정착빙 조기 붕괴 → 새끼 익사',
    sens: { hab: 40, heat: 0, acid: 0 },
    prep: { food: '크릴', special: '단단한 번식지', hazard: '표범물범', goal: '바다에 뛰어들어 크릴을 모으세요. 물속에서는 빠르지만 표범물범을 조심하세요. 얼음 위의 단단한 번식지를 찾으면 새끼를 지키기 좋아요. 얼음 가장자리는 점점 갈라져요.' },
    chain: ['화석 연료 연소', '대기 중 CO₂ 증가', '온실 효과 강화', '남극 바다 수온 상승', '정착빙 조기 붕괴', '새끼 익사 · 크릴 감소', '번식 실패'],
    intro: { id: 'p0', title: '겨울 번식지로', text: '영하 40도의 겨울. 수컷들은 알을 발등에 올리고 서로 몸을 붙여 거대한 허들을 만든다.',
      sci: '황제펭귄은 육지에 붙어 있는 단단한 바다 얼음(정착빙) 위에서 겨울에 번식한다. 새끼가 방수 깃털을 갖출 때까지 얼음이 버텨 줘야 한다.',
      c: [ { l: '허들 안쪽으로 파고든다', e: { energy: 5, health: 5 }, t: '동료들의 체온 덕분에 혹한을 견뎠다.' },
           { l: '바다 가까운 가장자리에 자리 잡는다', r: { p: .6, good: { e: { energy: 12 }, t: '바다가 가까워 먹이를 자주 구했다.' }, bad: { e: { health: -10 }, t: '눈보라를 정면으로 맞았다.' } } } ] },
    events: [
      [ { id: 'p1', title: '일찍 갈라진 얼음', text: '새끼들의 방수 깃털이 다 나기도 전에 발밑 얼음이 갈라지기 시작했다.',
          sci: '2022년 남극 벨링스하우젠해에서는 해빙이 기록적으로 줄어 황제펭귄 번식지 5곳 중 4곳에서 새끼가 거의 살아남지 못했다. 깃털이 다 나기 전에 얼음이 깨졌기 때문이다.',
          c: [ { l: '새끼들을 안쪽 단단한 얼음으로 옮긴다', e: { energy: -12 }, t: '힘들게 새끼들을 안쪽으로 데려갔다.' },
               { l: '그대로 기다린다', r: { p: .4, flagP: { colony: .7 }, good: { e: { pop: 5 }, t: '얼음이 마지막까지 버텨 주었다.' }, bad: { e: { pop: -18 }, t: '얼음이 깨지며 새끼들이 바다에 빠졌다.' } } } ] },
        { id: 'p2', title: '줄어든 크릴', text: '바다 얼음 아래에서 자라던 조류가 줄며 크릴 떼도 줄었다.',
          sci: '해빙 아래 조류 → 크릴 → 펭귄으로 이어지는 먹이 사슬. 해빙이 줄면 먹이 사슬의 맨 아래부터 흔들린다.',
          c: [ { l: '더 깊이, 더 오래 잠수한다', e: { energy: 8, health: -8 }, t: '깊은 바다에서 먹이를 찾았지만 몸이 지쳤다.' },
               { l: '물고기·오징어로 먹이를 바꾼다', e: { energy: 4, food: 2 }, t: '새로운 먹이에 익숙해졌다.' } ] },
        { id: 'p3', title: '젖은 솜털', text: '눈보라 대신 젖은 진눈깨비가 내려 새끼들의 솜털이 흠뻑 젖었다.',
          sci: '새끼 펭귄의 솜털은 방수가 되지 않는다. 젖은 솜털은 보온력이 크게 떨어져 새끼가 체온을 잃는다.',
          c: [ { l: '허들을 더 촘촘히 만든다', e: { energy: -8, health: 5 }, t: '어른들이 둘러싸 새끼들을 지켰다.' },
               { l: '먹이를 더 물어 와 버틴다', e: { energy: 5, pop: -6 }, t: '먹이는 넉넉했지만 약한 새끼들이 추위를 이기지 못했다.' } ] } ],
      [ { id: 'p4', title: '새 번식지 탐색', text: '옛 번식지의 얼음이 해마다 불안정하다. 일부가 높은 빙붕 위로 올라가는 길을 찾았다.',
          sci: '실제로 일부 황제펭귄 무리는 바다 얼음이 불안정해지자 육지에 붙은 빙붕 위로 번식지를 옮기는 모습이 관찰되었다.',
          c: [ { l: '빙붕 위로 번식지를 옮긴다', r: { p: .55, good: { e: { hab: 12 }, t: '높고 단단한 빙붕 위에 새 번식지를 만들었다!' }, bad: { e: { pop: -10, energy: -10 }, t: '가파른 빙벽을 오르다 많은 무리가 지쳐 쓰러졌다.' } } },
               { l: '옛 번식지를 지킨다', e: { hab: -5 }, t: '익숙한 곳에 남았지만 얼음은 해마다 약해진다.' } ] },
        { id: 'p5', title: '남극의 비', text: '남극 해안에 비가 내렸다. 얼음 표면이 미끄럽게 얼어붙었다.',
          sci: '기온이 영하를 벗어나는 날이 늘면 남극 해안에도 비가 내린다. 비에 젖은 새끼는 체온을 빠르게 잃는다.',
          c: [ { l: '새끼들을 품에 감싼다', e: { energy: -10 }, t: '부모들이 몸으로 비를 막았다.' },
               { l: '먹이 사냥을 계속한다', r: { p: .5, good: { e: { energy: 10 }, t: '사냥은 성공했고 비도 곧 그쳤다.' }, bad: { e: { pop: -12 }, t: '비에 젖은 새끼들이 체온을 잃었다.' } } } ] },
        { id: 'p6', title: '늘어난 범고래', text: '해빙이 줄어 탁 트인 바다에 범고래가 자주 나타난다.',
          sci: '해빙은 펭귄이 포식자를 피하는 피난처이기도 하다. 얼음이 줄면 포식자에게 더 쉽게 노출된다.',
          c: [ { l: '얼음 가장자리에서만 사냥한다', e: { energy: -5 }, t: '안전했지만 먹이는 적었다.' },
               { l: '먼 바다까지 나가 사냥한다', r: { p: .55, good: { e: { energy: 15 }, t: '먼 바다에서 크릴 떼를 만났다!' }, bad: { e: { pop: -10 }, t: '범고래에게 무리 일부를 잃었다.' } } } ] } ],
      [ { id: 'p7', title: '무너진 빙붕', text: '거대한 빙붕 일부가 굉음과 함께 바다로 무너져 내렸다.',
          sci: '육지 위의 빙하와 빙붕이 녹아 바다로 흘러들면 해수면이 높아진다. 반면 바다 위에 떠 있던 해빙이 녹는 것은 해수면을 거의 높이지 않는다.',
          c: [ { l: '빙산 뒤 잔잔한 바다로 옮긴다', e: { energy: -8, hab: 5 }, t: '빙산이 파도를 막아 주는 곳을 찾았다.' },
               { l: '그 자리에 남는다', e: { hab: -8 }, t: '번식지 앞바다가 거칠어졌다.' } ] },
        { id: 'p8', title: '따뜻해진 바다', text: '주변 바다 수온이 올라 먹이가 더 먼 곳으로 옮겨 갔다.',
          sci: '수온이 오르면 차가운 물을 좋아하는 생물은 극 쪽으로 이동한다. 먹이가 멀어지면 부모가 먹이를 구해 오는 데 더 오래 걸린다.',
          c: [ { l: '먹이를 따라 멀리 다녀온다', e: { energy: -10, food: 4 }, t: '먼 먹이터를 찾아냈다.' },
               { l: '가까운 바다에서 버틴다', e: { health: -6 }, t: '먹이가 부족해 무리가 야위었다.' } ] },
        { id: 'p9', title: '마지막 단단한 얼음', text: '해안을 따라 단단한 정착빙이 남은 곳은 이제 몇 곳뿐이다.',
          sci: '고배출 경로가 이어지면 2100년까지 황제펭귄 번식지의 대부분이 사라질 수 있다는 연구가 있다.',
          c: [ { l: '무리 전체가 대이동한다', e: { energy: -18, hab: 12 }, t: '긴 행진 끝에 단단한 얼음에 닿았다.' },
               { l: '흩어져 각자 얼음을 찾는다', r: { p: .5, good: { e: { pop: 5 }, t: '여러 곳에 작은 번식지를 만들었다.' }, bad: { e: { pop: -15 }, t: '흩어진 무리 상당수가 돌아오지 못했다.' } } } ] } ],
    ],
  },
  coral: {
    key: 'coral', letter: 'C', name: '산호', place: '열대 산호초', habName: '수온 적합도', energyName: '영양분', popName: '산호 면적', healthName: '공생조류',
    tagline: '바다가 1~2°C만 뜨거워져도 하얗게 질린다',
    threat: '해양 열파 → 백화 · 산성화',
    sens: { hab: 36, heat: 3, acid: 0.03 },
    prep: { food: '플랑크톤', special: '공생조류', hazard: '해양 열파', goal: '산호 유생이 되어 플랑크톤을 먹고, 초록빛 공생조류를 모으세요. 뜨거운 바닷물(빨간 영역)은 점점 넓어져요. 왕관불가사리도 피하세요.' },
    chain: ['화석 연료 연소', '대기 중 CO₂ 증가', '온실 효과 강화 + 바다의 CO₂ 흡수', '수온 상승 · 해양 산성화', '공생조류 방출(백화) · 골격 약화', '영양 부족', '산호 폐사'],
    intro: { id: 'c0', title: '산란의 밤', text: '보름달이 뜬 밤, 산호들이 일제히 분홍빛 알과 정자 묶음을 내뿜었다. 바다가 별처럼 반짝인다.',
      sci: '산호는 몸속에 사는 공생조류(황록공생조류)가 광합성으로 만든 양분을 받아 살아간다. 산호의 화려한 색도 이 공생조류 덕분이다.',
      c: [ { l: '얕고 햇빛 많은 곳에 정착한다', e: { energy: 10 }, t: '햇빛이 풍부해 공생조류가 양분을 넉넉히 만들었다.' },
           { l: '조금 깊고 시원한 곳에 정착한다', e: { energy: 3, hab: 6 }, t: '빛은 조금 약하지만 물이 시원하다.' } ] },
    events: [
      [ { id: 'c1', title: '첫 해양 열파', text: '수온이 평년보다 1°C 높은 날이 몇 주째 이어진다. 산호의 색이 옅어지기 시작했다.',
          sci: '수온이 평소보다 1~2°C 높은 상태가 몇 주 이어지면 산호는 공생조류를 몸 밖으로 내보낸다. 투명한 몸 아래 하얀 골격이 드러나는 것이 백화 현상이다.',
          c: [ { l: '공생조류를 붙잡아 둔다', r: { p: .5, good: { e: { health: 5 }, t: '열파가 일찍 끝나 색을 지켰다.' }, bad: { e: { health: -20 }, t: '버티다 결국 공생조류 대부분을 잃었다.' } } },
               { l: '공생조류 일부를 내보낸다', e: { health: -12, energy: -5 }, t: '색이 옅어졌지만 큰 손상은 피했다.' } ] },
        { id: 'c2', title: '흙탕물', text: '폭우로 육지의 흙탕물이 바다로 흘러들었다. 빛이 잘 들지 않는다.',
          sci: '기후 변화로 집중 호우가 잦아지면 육지의 흙과 오염 물질이 바다로 흘러들어 산호를 덮는다.',
          c: [ { l: '점액을 내어 몸을 덮는다', e: { energy: -8, health: 3 }, t: '점액으로 흙을 씻어 냈다.' },
               { l: '그대로 견딘다', e: { health: -8 }, t: '빛이 부족해 공생조류가 약해졌다.' } ] },
        { id: 'c3', title: '물고기 청소부', text: '비늘돔과 쥐돔 떼가 찾아와 산호 위 해조류를 뜯어 먹는다.',
          sci: '산호초는 바다 생물의 약 4분의 1이 기대어 사는 곳이다. 초식 물고기가 해조류를 먹어 줘야 산호가 자랄 공간이 생긴다.',
          c: [ { l: '해조류 청소를 맡긴다', e: { health: 6 }, t: '깨끗해진 표면에 햇빛이 잘 든다.' },
               { l: '빈 공간으로 빠르게 자란다', e: { pop: 6, energy: -8 }, t: '산호초가 넓어졌다.' } ] } ],
      [ { id: 'c4', title: '산성화되는 바다', text: '물이 왠지 시큼하다. 탄산칼슘 골격을 쌓기가 점점 힘들어진다.',
          sci: '바다는 대기 중 CO₂의 약 4분의 1을 흡수한다. 녹은 CO₂가 탄산이 되어 바다가 산성화하면 산호와 조개가 탄산칼슘 골격을 만들기 어려워진다.',
          c: [ { l: '성장을 늦추고 에너지를 아낀다', e: { pop: -3, energy: 5 }, t: '천천히 자라며 힘을 아꼈다.' },
               { l: '무리해서 골격을 쌓는다', e: { energy: -15, pop: 4 }, t: '힘겹게 골격을 쌓았다.' } ] },
        { id: 'c5', title: '두 번째 대백화', text: '몇 년 만에 또다시 거대한 열파가 몰려왔다. 회복할 시간이 부족하다.',
          sci: '백화된 산호는 바로 죽지는 않지만, 수온이 내려가 공생조류가 돌아오기 전까지 굶는다. 백화가 자주 반복되면 회복하지 못하고 죽는다.',
          c: [ { l: '그늘진 틈에서 버틴다', e: { health: -10 }, t: '일부는 그늘 덕분에 색을 지켰다.' },
               { l: '플랑크톤을 잡아먹으며 버틴다', r: { p: .55, good: { e: { energy: 10 }, t: '촉수로 플랑크톤을 잡아 굶주림을 버텼다.' }, bad: { e: { pop: -12 }, t: '굶주림을 견디지 못한 산호가 죽었다.' } } } ] },
        { id: 'c6', title: '왕관불가사리 떼', text: '왕관불가사리 떼가 몰려와 산호를 갉아 먹는다.',
          sci: '약해진 산호초에는 왕관불가사리 같은 포식자의 피해가 더 크게 나타난다.',
          c: [ { l: '버티며 기다린다', e: { pop: -10 }, t: '산호초 일부가 하얗게 뜯겨 나갔다.' },
               { l: '빠르게 재성장한다', e: { energy: -12, pop: -3 }, t: '먹힌 곳을 빠르게 메웠다.' } ] } ],
      [ { id: 'c7', title: '더 깊은 바다로', text: '얕은 바다는 너무 뜨겁다. 유생 일부를 더 깊고 시원한 곳으로 보낼 수 있다.',
          sci: '생물은 온난화를 피해 더 차가운 곳(극 쪽, 깊은 곳, 높은 곳)으로 서식지를 옮긴다. 하지만 이동할 수 있는 곳에는 한계가 있다.',
          c: [ { l: '깊은 곳으로 유생을 보낸다', r: { p: .5, good: { e: { hab: 10 }, t: '깊은 바다에 새 산호 군락이 자리 잡았다.' }, bad: { e: { pop: -8 }, t: '빛이 너무 약해 유생들이 자라지 못했다.' } } },
               { l: '지금 자리에 남는다', e: { hab: -5 }, t: '익숙한 곳에 남았지만 바다는 점점 뜨거워진다.' } ] },
        { id: 'c8', title: '높아진 바다', text: '해수면이 높아져 산호초 위 물이 깊어졌다. 빛이 조금 덜 닿는다.',
          sci: '해수면 상승의 주된 원인은 따뜻해진 바닷물의 부피가 늘어나는 열팽창과, 육지 빙하가 녹아 바다로 들어오는 것이다.',
          c: [ { l: '위쪽으로 빠르게 자란다', e: { energy: -10, pop: 3 }, t: '빛을 따라 위로 자랐다.' },
               { l: '에너지를 아끼며 버틴다', e: { energy: -4, health: -4 }, t: '빛이 부족해 조금 약해졌다.' } ] },
        { id: 'c9', title: '더위에 강한 공생조류', text: '근처 바다에 더위에 강한 공생조류가 있다고 한다.',
          sci: '일부 산호는 열에 강한 공생조류로 바꾸어 더위를 견딘다. 하지만 이런 적응은 느리고, 온난화 속도가 빠르면 따라가지 못한다.',
          c: [ { l: '새 공생조류를 받아들인다', r: { p: .6, good: { e: { health: 15, hab: 6 }, t: '더위에 강한 공생조류와 함께 다시 색을 찾았다!' }, bad: { e: { health: -10 }, t: '새 공생조류와 잘 맞지 않았다.' } } },
               { l: '기존 공생조류를 지킨다', e: {}, t: '익숙한 공생조류와 함께 버틴다.' } ] } ],
    ],
  },
  pollock: {
    key: 'pollock', letter: 'F', name: '명태', place: '동해', habName: '냉수대', energyName: '먹이', popName: '어군', healthName: '건강',
    tagline: '차가운 동해가 사라지면 갈 곳이 없다',
    threat: '동해 수온 상승 → 냉수대 축소',
    sens: { hab: 42, heat: 2, acid: 0 },
    prep: { food: '동물성 플랑크톤', special: '산란장', hazard: '따뜻한 물 · 그물', goal: '명태 떼를 이끌고 차가운 바다에서 플랑크톤을 먹으세요. 남쪽에서 따뜻한 물이 점점 올라와요(주황 영역). 그물도 피하세요. 북서쪽 연안의 산란장을 찾으면 어군이 늘어요.' },
    chain: ['화석 연료 연소', '대기 중 CO₂ 증가', '온실 효과 강화', '동해 수온 상승', '냉수대 축소 · 먹이 변화', '서식지 북상 (+ 어린 명태 남획)', '동해 명태 감소'],
    intro: { id: 'f0', title: '동해의 겨울', text: '차가운 북한 한류를 따라 동해 연안으로 산란하러 내려왔다.',
      sci: '명태는 2~10°C 정도의 찬물을 좋아하는 한류성 어종이다. 1981년 동해에서는 명태가 한 해 약 16만 톤이나 잡혔다.',
      c: [ { l: '연안 가까이에서 산란한다', e: { energy: 5, pop: 5 }, t: '연안 산란장에서 알을 많이 낳았다.' },
           { l: '먼 바다 깊은 곳에서 산란한다', e: { hab: 5 }, t: '차갑고 깊은 곳을 골랐다.' } ] },
    events: [
      [ { id: 'f1', title: '따뜻해진 동해', text: '동해 표층 수온이 올라 차가운 물이 점점 줄어든다.',
          sci: '동해는 최근 50여 년 동안 표층 수온이 약 1.4°C 올라 우리나라 바다 중 상승 폭이 가장 컸다. 전 세계 바다 평균보다 빠르다.',
          c: [ { l: '더 깊은 찬물로 내려간다', e: { energy: -8, hab: 6 }, t: '깊은 곳에 찬물이 남아 있었다.' },
               { l: '그대로 버틴다', e: { health: -10 }, t: '따뜻한 물에서 몸이 지쳤다.' } ] },
        { id: 'f2', title: '노가리 그물', text: '어린 명태(노가리)를 노리는 그물이 바다에 가득하다.',
          sci: '1980년대에는 어린 명태인 노가리가 잡힌 명태의 대부분을 차지했다. 수온 상승과 남획이 겹치며 동해 명태는 2008년 공식 어획량 0톤이 되었다.',
          c: [ { l: '무리를 흩어 피한다', e: { pop: -8 }, t: '많은 노가리가 그물에 걸렸다.' },
               { l: '빠르게 북쪽으로 피한다', e: { energy: -12, pop: -3 }, t: '먼 길을 헤엄쳐 그물을 피했다.' } ] },
        { id: 'f3', title: '바뀐 먹이', text: '찬물에 사는 동물성 플랑크톤이 줄고 따뜻한 물에 사는 종류가 늘었다.',
          sci: '수온이 오르면 먹이 생물의 종류와 양도 바뀐다. 동해에서는 수온 상승으로 영양염 공급이 줄어 명태의 먹이 환경이 나빠졌다.',
          c: [ { l: '새 먹이에 적응한다', e: { energy: 5, health: -5 }, t: '새 먹이는 영양이 조금 부족했다.' },
               { l: '찬물 먹이를 찾아 북쪽으로', e: { energy: -10, food: 3 }, t: '북쪽에서 익숙한 먹이터를 찾았다.' } ] } ],
      [ { id: 'f4', title: '올라오는 난류', text: '따뜻한 동한 난류가 해마다 더 북쪽까지 올라온다.',
          sci: '수온이 오르면서 명태의 산란지와 서식지가 북쪽으로 이동했다. 옛날에는 포항 근처까지 내려오던 명태가 이제는 강원도 북쪽 바다에서도 보기 어렵다.',
          c: [ { l: '북쪽 러시아 바다로 이동한다', e: { energy: -15, hab: 10 }, t: '차가운 북쪽 바다에 닿았다.' },
               { l: '동해에 남는다', e: { hab: -8 }, t: '고향 바다는 해마다 따뜻해진다.' } ] },
        { id: 'f5', title: '부화하지 않는 알', text: '산란장 수온이 너무 높아 알이 잘 부화하지 않는다.',
          sci: '물고기 알과 어린 물고기는 어른보다 수온 변화에 훨씬 약하다.',
          c: [ { l: '산란 시기를 늦춘다', e: { pop: -4 }, t: '조금 늦었지만 알 일부가 부화했다.' },
               { l: '그대로 산란한다', r: { p: .4, flagP: { spawn: .7 }, good: { e: { pop: 8 }, t: '다행히 수온이 내려가 알이 잘 부화했다.' }, bad: { e: { pop: -14 }, t: '알 대부분이 부화하지 못했다.' } } } ] },
        { id: 'f6', title: '고등어 떼', text: '따뜻한 물을 좋아하는 고등어·멸치 떼가 크게 늘어 먹이 경쟁이 심해졌다.',
          sci: '우리나라 바다에서는 명태 같은 한류성 어종이 줄고 고등어·멸치 같은 난류성 어종이 늘었다.',
          c: [ { l: '먹이를 두고 경쟁한다', e: { energy: -5, health: -5 }, t: '먹이를 조금 나눠 가졌다.' },
               { l: '경쟁을 피해 깊은 곳으로', e: { energy: -10 }, t: '깊은 곳은 조용했지만 먹이가 적었다.' } ] } ],
      [ { id: 'f7', title: '명태 살리기', text: '사람들이 인공으로 부화시킨 어린 명태를 바다에 풀어 주었다.',
          sci: '우리나라는 2014년부터 "명태 살리기 프로젝트"로 어린 명태를 방류하고, 2019년부터 명태 포획을 전면 금지했다. 하지만 바다가 따뜻하면 방류한 명태도 살기 어렵다.',
          c: [ { l: '방류된 명태와 함께 무리를 이룬다', e: { pop: 10, energy: -5 }, t: '무리가 커졌다.' },
               { l: '원래 무리끼리 다닌다', e: { pop: 3 }, t: '조심스럽게 무리를 지켰다.' } ] },
        { id: 'f8', title: '숨 막히는 바다', text: '바닷물이 따뜻해지자 숨쉬기가 힘들어졌다.',
          sci: '기체의 용해도는 수온이 높을수록 작다. 바다가 따뜻해지면 물에 녹아 있는 산소가 줄어든다.',
          c: [ { l: '천천히 헤엄쳐 에너지를 아낀다', e: { energy: 5, health: -5 }, t: '움직임을 줄여 버텼다.' },
               { l: '산소 많은 찬물을 찾아간다', e: { energy: -12, health: 5 }, t: '찬물에서 다시 힘을 냈다.' } ] },
        { id: 'f9', title: '마지막 찬물', text: '동해에서 찬물이 남은 곳은 이제 북쪽 깊은 바다뿐이다.',
          sci: '생물은 온난화를 피해 서식지를 옮기지만, 바다가 계속 따뜻해지면 더 갈 곳이 없어진다.',
          c: [ { l: '북쪽 끝까지 대이동한다', e: { energy: -18, hab: 12 }, t: '오호츠크해 가까이 차가운 바다에 닿았다.' },
               { l: '흩어져 찬물을 찾는다', r: { p: .5, good: { e: { pop: 5 }, t: '곳곳의 작은 찬물에 자리 잡았다.' }, bad: { e: { pop: -15 }, t: '흩어진 무리 상당수가 사라졌다.' } } } ] } ],
    ],
  },
};
const ANIMAL_ORDER = ['bear', 'penguin', 'coral', 'pollock'];

// 과학 무전 (퀴즈)
const QUIZ = [
  { q: '지구가 우주로 내보내는 복사 에너지는 주로 어떤 파장일까?', a: ['적외선', '자외선', '가시광선', 'X선'], c: 0, e: '태양은 주로 가시광선 같은 짧은 파장으로, 지구는 주로 적외선 같은 긴 파장으로 에너지를 내보낸다. 온실 기체는 이 적외선을 흡수했다가 다시 방출한다.' },
  { q: '다음 중 온실 기체가 아닌 것은?', a: ['질소(N₂)', '이산화 탄소(CO₂)', '메테인(CH₄)', '수증기(H₂O)'], c: 0, e: '대기의 약 78%를 차지하는 질소와 약 21%인 산소는 적외선을 거의 흡수하지 않아 온실 기체가 아니다.' },
  { q: '대기의 온실 효과가 전혀 없다면 지구의 평균 기온은 약 몇 °C일까?', a: ['약 −18°C', '약 15°C', '약 0°C', '약 30°C'], c: 0, e: '온실 효과 덕분에 지구 평균 기온은 약 15°C로 유지된다. 온실 효과 자체는 생명에 꼭 필요하며, 문제는 온실 효과가 지나치게 강해지는 것이다.' },
  { q: '해빙이 녹으면 온난화가 더 빨라지는 까닭은?', a: ['반사율이 낮은 바다가 햇빛을 더 많이 흡수해서', '얼음이 녹으며 열을 내보내서', '바닷물이 증발해 구름이 사라져서', '얼음 속 산소가 빠져나가서'], c: 0, e: '하얀 얼음은 햇빛의 대부분을 반사하지만 어두운 바다는 대부분 흡수한다. 이 알베도 되먹임 때문에 북극은 지구 평균보다 훨씬 빠르게 따뜻해진다.' },
  { q: '지구 온난화로 해수면이 높아지는 주된 원인 두 가지는?', a: ['바닷물의 열팽창과 육지 빙하의 융해', '바다 위 해빙의 융해와 강수량 증가', '해저 화산과 지진', '바닷물의 증발과 염분 감소'], c: 0, e: '바다 위에 떠 있는 해빙은 녹아도 해수면을 거의 높이지 않는다. 물에 뜬 얼음이 녹는 컵 실험을 떠올려 보자.' },
  { q: '바다가 CO₂를 많이 흡수하면 생기는 현상은?', a: ['해양 산성화로 산호·조개가 골격을 만들기 어려워진다', '바닷물의 염분이 높아진다', '바다의 산소가 늘어난다', '바닷물이 알칼리성이 된다'], c: 0, e: 'CO₂가 물에 녹아 탄산이 되면 바다의 pH가 낮아진다. 탄산칼슘 골격을 만드는 생물이 큰 피해를 입는다.' },
  { q: '"탄소 중립"의 뜻으로 옳은 것은?', a: ['배출한 만큼 흡수·제거해 순배출을 0으로 만드는 것', '탄소를 전혀 사용하지 않는 것', '화석 연료 사용량을 절반으로 줄이는 것', '대기 중 CO₂를 모두 없애는 것'], c: 0, e: '배출을 최대한 줄이고, 남는 배출은 숲 가꾸기나 포집 기술로 흡수해 순배출을 0으로 만든다. 우리나라는 2050년 탄소 중립을 목표로 한다.' },
  { q: '지구가 복사 평형 상태일 때 옳은 것은?', a: ['흡수하는 태양 복사 에너지양 = 방출하는 지구 복사 에너지양', '흡수하는 양이 방출하는 양보다 많다', '태양 복사와 지구 복사의 파장이 같다', '지구가 에너지를 방출하지 않는다'], c: 0, e: '들어오는 만큼 나가면 온도가 일정하다. 온실 기체가 늘면 나가는 에너지가 잠시 줄어, 더 높은 온도에서 새로운 평형을 이룬다.' },
  { q: '같은 양일 때 CO₂보다 온난화 효과가 훨씬 큰 온실 기체는?', a: ['메테인(CH₄)', '산소(O₂)', '아르곤(Ar)', '질소(N₂)'], c: 0, e: '메테인은 같은 양일 때 100년 기준으로 CO₂의 약 28배 온난화 효과를 낸다. 가축, 논, 쓰레기 매립지, 녹는 영구 동토층에서 나온다.' },
];

// ---- 시드 난수 ----
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TUNE = { f0: 10, f1: 0.30, up: 40, e0: 45, h0: 55, hb: 55, hd: 5 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function eventOrder(code, animal) {
  const A = ANIMALS[animal], r = rng(hashStr('ord|' + code + '|' + animal));
  return [A.intro.id].concat(...A.events.map(tier => shuffle(tier, r).map(e => e.id)));
}
function quizOrder(code) {
  const r = rng(hashStr('quiz|' + code));
  return shuffle(QUIZ.map((_, i) => i), r).slice(0, 5);
}
function findEvent(animal, id) {
  const A = ANIMALS[animal];
  if (A.intro.id === id) return A.intro;
  for (const tier of A.events) for (const e of tier) if (e.id === id) return e;
  return null;
}
// 퀴즈가 나오는 세대(0부터): 2, 4, 6, 8, 10세대
const QUIZ_GENS = [1, 3, 5, 7, 9];

function baseHab(animal, T, ppm) {
  const s = ANIMALS[animal].sens;
  return 100 - (T - 1.2) * s.hab - Math.max(0, ppm - 420) * s.acid;
}

function newRun(code, team, animal, scen) {
  return {
    v: 1, code: String(code).trim(), team: String(team).trim(), animal, scen,
    phase: 'prep', gen: 0, sub: 'event', // sub: event | outcome | quiz | quizdone
    pop: 50, energy: 50, health: 80, habMod: 0, foodMod: 0, flags: {},
    init: null, choices: [], log: [], quizAns: {}, extinctAt: null,
    order: eventOrder(code, animal), quiz: quizOrder(code),
  };
}

// 60초 준비 결과 반영
function applyPrep(run, res) {
  run.prep = res;
  run.energy = clamp(30 + res.food * 5, 30, 100);
  run.health = clamp(100 - res.damage, 35, 100);
  run.pop = clamp(50 + res.special * 8, 50, 76);
  if (res.special > 0) run.flags[{ bear: 'den', penguin: 'colony', coral: 'symb', pollock: 'spawn' }[run.animal]] = true;
  if (run.animal === 'coral' && res.special > 0) run.health = clamp(run.health + res.special * 4, 0, 100);
  run.init = { pop: run.pop, energy: run.energy, health: run.health, flags: { ...run.flags } };
  run.phase = 'play'; run.gen = 0; run.sub = 'event';
}

function addE(st, e) {
  if (!e) return;
  if (e.pop) st.pop += e.pop;
  if (e.energy) st.energy += e.energy;
  if (e.health) st.health += e.health;
  if (e.hab) st.habMod += e.hab;
  if (e.food) st.foodMod += e.food;
  st.pop = clamp(st.pop, 0, 100); st.energy = clamp(st.energy, 0, 100); st.health = clamp(st.health, 0, 100);
}

// 한 세대 진행 (순수): st = {pop, energy, health, habMod, foodMod, flags}
function stepGen(animal, scenKey, code, team, gen, st, choiceIdx, quizBonus) {
  const S = SCENARIOS[scenKey], T = S.T[gen], ppm = S.ppm[gen];
  const run0 = { ...st };
  const ev = findEvent(animal, eventOrder(code, animal)[gen]);
  const ch = ev.c[choiceIdx];
  let text = ch.t || '', eff = ch.e || {}, roll = null, good = null;
  if (ch.r) {
    const rr = rng(hashStr('roll|' + code + '|' + team + '|' + animal + '|' + gen))();
    let p = ch.r.p;
    if (ch.r.flagP) for (const f in ch.r.flagP) if (st.flags[f]) p = ch.r.flagP[f];
    good = rr < p; roll = { p, good };
    eff = good ? ch.r.good.e : ch.r.bad.e; text = good ? ch.r.good.t : ch.r.bad.t;
  }
  const s = { pop: st.pop, energy: st.energy, health: st.health, habMod: st.habMod, foodMod: st.foodMod, flags: st.flags };
  addE(s, eff);
  if (quizBonus) addE(s, { energy: 12, health: 5 });
  // 자연 변화
  const A = ANIMALS[animal];
  const hab = clamp(baseHab(animal, T, ppm) + s.habMod, 0, 100);
  const food = TUNE.f0 + hab * TUNE.f1 + s.foodMod;
  s.energy = clamp(s.energy + food - TUNE.up, 0, 100);
  let dh = s.energy < 25 ? -14 : s.energy >= 60 ? 5 : 0;
  dh -= Math.max(0, T - 1.5) * A.sens.heat;
  s.health = clamp(s.health + dh, 0, 100);
  const dp = clamp(Math.round((s.energy - TUNE.e0) / 5 + (s.health - TUNE.h0) / 8 + (hab - TUNE.hb) / TUNE.hd), -25, 6);
  s.pop = clamp(s.pop + dp, 0, 100);
  return { state: s, T, ppm, hab, text, eff, roll, natural: { food: Math.round(food - TUNE.up), dh: Math.round(dh), dp }, before: run0 };
}

function choose(run, idx) {
  if (run.phase !== 'play' || run.sub !== 'event') return null;
  const quizBonus = false;
  const res = stepGen(run.animal, run.scen, run.code, run.team, run.gen, run, idx, quizBonus);
  Object.assign(run, { pop: res.state.pop, energy: res.state.energy, health: res.state.health, habMod: res.state.habMod, foodMod: res.state.foodMod });
  run.choices[run.gen] = idx;
  run.last = { gen: run.gen, idx, text: res.text, eff: res.eff, roll: res.roll, natural: res.natural, T: res.T, ppm: res.ppm, hab: res.hab, before: { pop: res.before.pop, energy: res.before.energy, health: res.before.health } };
  run.log.push({ gen: run.gen, id: run.order[run.gen], idx, text: res.text, pop: run.pop });
  if (run.pop <= 0) { run.extinctAt = run.gen; run.sub = 'outcome'; return res; }
  run.sub = 'outcome';
  return res;
}

function hasQuiz(run) { return QUIZ_GENS.includes(run.gen); }
function quizFor(run) { return QUIZ[run.quiz[QUIZ_GENS.indexOf(run.gen)]]; }
function answerQuiz(run, ai) {
  const Q = quizFor(run), ok = ai === Q.c;
  run.quizAns[run.gen] = { ai, ok };
  if (ok) { run.energy = clamp(run.energy + 12, 0, 100); run.health = clamp(run.health + 5, 0, 100); }
  run.sub = 'quizdone';
  return ok;
}
function advance(run) {
  if (run.extinctAt != null) { run.phase = 'end'; return; }
  if (run.sub === 'outcome' && hasQuiz(run)) { run.sub = 'quiz'; return; }
  if (run.gen >= GENS - 1) { run.phase = 'end'; return; }
  run.gen++; run.sub = 'event';
}
function currentHab(run) {
  const S = SCENARIOS[run.scen], g = Math.min(run.gen, GENS - 1);
  return clamp(baseHab(run.animal, S.T[g], S.ppm[g]) + run.habMod, 0, 100);
}

// 같은 선택을 다른 배출 시나리오에서 했다면?
function replay(run, scenKey) {
  let st = { pop: run.init.pop, energy: run.init.energy, health: run.init.health, habMod: 0, foodMod: 0, flags: { ...run.init.flags } };
  const popHist = [];
  let survived = 0;
  for (let g = 0; g < GENS; g++) {
    const ci = run.choices[g] != null ? run.choices[g] : 0;
    const qa = run.quizAns[g];
    const res = stepGen(run.animal, scenKey, run.code, run.team, g, st, ci, false);
    st = res.state;
    if (qa && qa.ok) { st.energy = clamp(st.energy + 12, 0, 100); st.health = clamp(st.health + 5, 0, 100); }
    popHist.push(st.pop);
    if (st.pop <= 0) break;
    survived = g + 1;
  }
  return { survived, pop: st.pop, popHist };
}

function gensSurvived(run) { return run.extinctAt != null ? run.extinctAt : Math.min(run.gen + 1, GENS); }
function checkDigits(s) { return (hashStr('chk|' + s) % 90) + 10; }
function resultCode(run) {
  const body = ANIMALS[run.animal].letter + SCENARIOS[run.scen].digit + '-' + gensSurvived(run) + '-' + run.pop;
  return body + '-' + checkDigits(body + '|' + run.team);
}
function parseCode(str, team) {
  const m = String(str).trim().toUpperCase().match(/^([BPCF])([123])-(\d{1,2})-(\d{1,3})-(\d{2})$/);
  if (!m) return null;
  const animal = ANIMAL_ORDER.find(k => ANIMALS[k].letter === m[1]);
  const scen = SCEN_ORDER.find(k => SCENARIOS[k].digit === +m[2]);
  const body = m[1] + m[2] + '-' + m[3] + '-' + m[4];
  return { animal, scen, gens: +m[3], pop: +m[4], ok: checkDigits(body + '|' + String(team).trim()) === +m[5] };
}

if (typeof module !== 'undefined') module.exports = { TUNE, GENS, DECADES, SCENARIOS, SCEN_ORDER, ANIMALS, ANIMAL_ORDER, QUIZ, QUIZ_GENS, eventOrder, findEvent, newRun, applyPrep, choose, hasQuiz, quizFor, answerQuiz, advance, currentHab, replay, resultCode, parseCode, gensSurvived, baseHab, stepGen, hashStr, rng };
