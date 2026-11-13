'use strict';
// ---- ことば: 日本語 / 英語 / 中国語(簡体字)/ 韓国語。画面に出す文字だけをここにまとめる ----
// 最初は端末(OS・ブラウザ)の言語で決まる(日本語・中国語・韓国語以外は英語)。設定で変えたら端末に覚えておく。
// URL に ?lang=en などを付けても切り替えられる(確かめる用)
const LANGS = ['ja', 'en', 'zh', 'ko'];
const LANG_NAME = { ja: '日本語', en: 'English', zh: '中文', ko: '한국어' };
function osLang() {
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
  const l = String(list[0] || 'en').toLowerCase();
  return l.startsWith('ja') ? 'ja' : l.startsWith('zh') ? 'zh' : l.startsWith('ko') ? 'ko' : 'en';
}
let lang = (() => {
  const q = (location.search.match(/[?&]lang=(\w+)/) || [])[1];
  if (LANGS.includes(q)) return q;
  try { const s = localStorage.getItem('eq_lang'); if (LANGS.includes(s)) return s; } catch (e) {}
  return osLang();
})();

// [日本語, 英語, 中国語, 韓国語]
const STR = {
  // タイトル
  subtitle:   ['ルネリアと たまごの ぼうけん', "Luneria's Egg Adventure", '露内莉亚与蛋的冒险', '루네리아와 알의 모험'],
  start:      ['スタート', 'START', '开始', '시작'],
  cont:       ['つづきから', 'CONTINUE', '继续游戏', '이어하기'],
  // ランキング
  ranking:    ['ランキング', 'RANKING', '排行榜', '랭킹'],
  regTitle:   ['ランキング登録', 'SUBMIT SCORE', '登记成绩', '랭킹 등록'],
  regBtn:     ['登録する', 'SUBMIT', '登记', '등록하기'],
  yourName:   ['なまえ(12文字まで)', 'Your name (up to 12)', '名字(最多12字)', '이름(12자까지)'],
  needName:   ['なまえを入れてください', 'Please enter your name', '请输入名字', '이름을 입력해 주세요'],
  sending:    ['送信中...', 'Sending...', '发送中...', '보내는 중...'],
  rankIs:     ['{n}位になりました!', 'You are #{n}!', '第{n}名!', '{n}위입니다!'],
  notTop:     ['100位に届きませんでした', 'Not in the top 100', '未进入前100名', '100위 안에 들지 못했어요'],
  tooFast:    ['少し時間をおいてから登録してください', 'Please wait a moment and try again', '请稍后再试', '잠시 후에 다시 등록해 주세요'],
  tooMany:    ['この端末から登録できる名前の数を超えました', 'Too many names from this device', '此设备登记的名字太多了', '이 기기에서 등록할 수 있는 이름 수를 넘었어요'],
  rankFail:   ['ランキングサーバーにつながりませんでした', 'Could not reach the ranking server', '无法连接排行榜服务器', '랭킹 서버에 연결할 수 없었어요'],
  loading:    ['読み込み中...', 'Loading...', '读取中...', '불러오는 중...'],
  rankEmpty:  ['まだ記録がありません', 'No scores yet', '还没有记录', '아직 기록이 없어요'],
  settings:   ['せってい', 'SETTINGS', '设置', '설정'],
  howto:      ['あそびかた', 'HOW TO PLAY', '玩法', '플레이 방법'],
  titleHint:  ['↑↓で えらんで ＥＮＴＥＲ', '↑↓ to choose, ENTER to start', '↑↓选择  ENTER确定', '↑↓로 선택, ENTER로 결정'],
  // メニュー
  menu:       ['メニュー', 'MENU', '菜单', '메뉴'],
  close:      ['とじる', 'CLOSE', '关闭', '닫기'],
  resume:     ['つづける', 'RESUME', '继续', '계속하기'],
  restart:    ['リスタート', 'RESTART', '重新开始', '다시 시작'],
  toTitle:    ['タイトルへ', 'TITLE', '返回标题', '타이틀로'],
  bgm:        ['ＢＧＭ: ', 'BGM: ', 'BGM: ', 'BGM: '],
  on:         ['オン', 'ON', '开', '켬'],
  off:        ['オフ', 'OFF', '关', '끔'],
  controls:   ['そうさ: ', 'CONTROLS: ', '操作: ', '조작: '],
  flick:      ['フリック', 'FLICK', '滑动', '플릭'],
  buttons:    ['ボタン', 'BUTTONS', '按钮', '버튼'],
  language:   ['Language: ', 'Language: ', 'Language: ', 'Language: '],   // どの言語でも英語(読めない言語になっても、戻し方がわかるように)
  // ライン消し
  linesX:     ['ライン×', 'LINES×', '消行×', '라인×'],
  eggsX:      ['タマゴ×', 'EGGS×', '蛋×', '알×'],
  gap:        ['　', '  ', '  ', '  '],
  // 盤面に出す文字
  nextStage:  ['次のステージへ', 'NEXT STAGE', '前往下一关', '다음 스테이지로'],
  whyEnding:  ['ラスボスをたおした! ぼうけんクリア!', 'You beat the final boss!', '击败了最终首领!冒险通关!', '최종 보스를 쓰러뜨렸다! 모험 클리어!'],
  whyClear:   ['扉が開いた!', 'The door opened!', '门打开了!', '문이 열렸다!'],
  whyStack:   ['ブロックが積み上がった', 'The blocks piled up', '方块堆到顶了', '블록이 꼭대기까지 쌓였다'],
  tapMenu:    ['うえの がめんを タップで メニュー', 'Tap the top screen for MENU', '点击上方画面打开菜单', '위쪽 화면을 탭하면 메뉴'],
  rRestart:   ['Ｒでリスタート', 'Press R to restart', '按R重新开始', 'R로 다시 시작'],
  // ボスのカード
  cAttr:      ['特性:', 'Type:', '属性:', '속성:'],
  cWeak:      ['弱点:', 'Weak:', '弱点:', '약점:'],
  cHp:        ['体力:', 'HP:', '体力:', '체력:'],
  cAtk:       ['攻撃力:', 'ATK:', '攻击力:', '공격력:'],
  boss:       [' ボス', 'BOSS', ' 首领', ' 보스'],
  none:       ['なし', 'None', '无', '없음'],
  tackle:     ['(体当たり)', ' (Tackle)', '(冲撞)', '(돌진)'],
  magic:      ['(魔法)', ' (Magic)', '(魔法)', '(마법)'],
  waitEnemy:  ['つぎの敵を待っています', 'Waiting for the next enemy', '等待下一个敌人', '다음 적을 기다리는 중'],
  // そのほか(index.html)
  hardDrop:   ['ハードドロップ ⤓', 'HARD DROP ⤓', '硬降 ⤓', '하드 드롭 ⤓'],
  rotateMsg:  ['スマホを縦にしてください<br>(縦画面専用です)', 'Please hold your phone upright<br>(portrait only)', '请竖着拿手机<br>(仅支持竖屏)', '휴대폰을 세로로 들어 주세요<br>(세로 화면 전용)'],
};
// 属性の名前(カードの色のチップ)。ゲームの中では日本語の1文字(火・水…)で持っている
const ATTR_NAME = {
  '火': ['火', 'Fire', '火', '불'], '水': ['水', 'Water', '水', '물'], '草': ['草', 'Grass', '草', '풀'], '雷': ['雷', 'Thunder', '雷', '번개'],
  '氷': ['氷', 'Ice', '冰', '얼음'], '地': ['地', 'Earth', '地', '땅'], '闇': ['闇', 'Dark', '暗', '어둠'], '無': ['無', '-', '无', '무'],
};
// あそびかた: [操作, 動き] の列と、ひとことの説明
const HELP = {
  flick: [
    [['よこに ドラッグ', 'いどう'], ['ひだり / みぎを タップ', 'かいてん'], ['したの 2わりを タップ', '1マス おとす(ながおしで れんぞく)'], ['したへ はじく', 'すぐ おとす'],
     ['びんの ボタン', 'くすり(かいふく)'], ['つきの ボタン', 'げっこうは'], ['うえの がめんを タップ', 'メニュー']],
    [['Drag sideways', 'Move'], ['Tap left / right', 'Rotate'], ['Tap the bottom 20%', 'Drop 1 row (hold to repeat)'], ['Flick down', 'Hard drop'],
     ['Bottle button', 'Potion (heal)'], ['Moon button', 'Moon wave'], ['Tap the top screen', 'Menu']],
    [['左右拖动', '移动'], ['点击左侧 / 右侧', '旋转'], ['点击下方两成', '下落1格(长按连续)'], ['向下轻扫', '直接落下'],
     ['药瓶按钮', '药水(回复)'], ['月亮按钮', '月光波'], ['点击上方画面', '菜单']],
    [['좌우로 드래그', '이동'], ['왼쪽 / 오른쪽 탭', '회전'], ['아래 20% 탭', '1칸 내리기(길게 누르면 연속)'], ['아래로 튕기기', '바로 내리기'],
     ['병 버튼', '물약(회복)'], ['달 버튼', '월광파'], ['위쪽 화면 탭', '메뉴']],
  ],
  buttons: [
    [['がめんの ボタン', 'いどう・かいてん・おとす'], ['びんの ボタン', 'くすり(かいふく)'], ['つきの ボタン', 'げっこうは'], ['うえの がめんを タップ', 'メニュー']],
    [['On-screen buttons', 'Move / rotate / drop'], ['Bottle button', 'Potion (heal)'], ['Moon button', 'Moon wave'], ['Tap the top screen', 'Menu']],
    [['画面按钮', '移动・旋转・落下'], ['药瓶按钮', '药水(回复)'], ['月亮按钮', '月光波'], ['点击上方画面', '菜单']],
    [['화면 버튼', '이동・회전・내리기'], ['병 버튼', '물약(회복)'], ['달 버튼', '월광파'], ['위쪽 화면 탭', '메뉴']],
  ],
  keys: [
    [['← →', 'いどう'], ['↑ / X / Z', 'かいてん'], ['↓', '1マス おとす'], ['SPACE', 'すぐ おとす'], ['C / テンキー +', 'くすり(かいふく)'],
     ['V / テンキー ENTER', 'げっこうは'], ['ESC', 'メニュー'], ['P', 'ポーズ'], ['M', 'BGM オン/オフ'], ['R', 'リスタート']],
    [['← →', 'Move'], ['↑ / X / Z', 'Rotate'], ['↓', 'Drop 1 row'], ['SPACE', 'Hard drop'], ['C / Numpad +', 'Potion (heal)'],
     ['V / Numpad ENTER', 'Moon wave'], ['ESC', 'Menu'], ['P', 'Pause'], ['M', 'BGM on/off'], ['R', 'Restart']],
    [['← →', '移动'], ['↑ / X / Z', '旋转'], ['↓', '下落1格'], ['SPACE', '直接落下'], ['C / 小键盘 +', '药水(回复)'],
     ['V / 小键盘 ENTER', '月光波'], ['ESC', '菜单'], ['P', '暂停'], ['M', 'BGM 开/关'], ['R', '重新开始']],
    [['← →', '이동'], ['↑ / X / Z', '회전'], ['↓', '1칸 내리기'], ['SPACE', '바로 내리기'], ['C / 숫자패드 +', '물약(회복)'],
     ['V / 숫자패드 ENTER', '월광파'], ['ESC', '메뉴'], ['P', '일시정지'], ['M', 'BGM 켜기/끄기'], ['R', '다시 시작']],
  ],
  notes: [
    ['たまごを かさねて ラインを けそう', '水玉の たまごから モンスターが うまれて たたかうよ', 'ラインを けすと くすりと げっこうはが たまるよ'],
    ['Stack the eggs and clear lines!', 'Polka-dot eggs hatch monsters that fight for you.', 'Clearing lines fills the potion and the moon wave.'],
    ['叠起蛋来消除横行吧', '水玉蛋会孵出怪物替你战斗', '消行可以积攒药水和月光波'],
    ['알을 쌓아서 줄을 지우자', '물방울 알에서 몬스터가 태어나 싸워요', '줄을 지우면 물약과 월광파가 모여요'],
  ],
};
const LI = () => LANGS.indexOf(lang);
function T(key) { const s = STR[key]; return s ? s[LI()] : key; }
function attrName(a) { return (ATTR_NAME[a] || [a, a, a, a])[LI()]; }
// index.html の文字(data-i18n="キー" の付いたもの)を、いまの言語にする
// 書体: 美咲ゴシック(ドットの日本語フォント)は日本語のときだけ。中国語・韓国語で使うと、
// 一部の漢字だけドットになって混ざるので、英数字のドットフォント(Yodaka)と端末の書体にする
function fontStack() { return lang === 'ja' ? 'Yodaka, Misaki, sans-serif' : 'Yodaka, sans-serif'; }
function applyLangHtml() {
  if (!document.querySelectorAll) return;
  if (document.documentElement) {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
    if (document.documentElement.style) document.documentElement.style.setProperty('--font', lang === 'ja' ? "'Yodaka', 'Misaki', sans-serif" : "'Yodaka', sans-serif");
  }
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = T(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = T(el.dataset.i18nHtml);
}
