// EGG QUEST — © 2026 daisuqe. All rights reserved.
// 本ゲームの著作権は daisuqe が保有します。無断での複製・改変・再配布・転載を禁じます。詳しくは LICENSE を見てください。
// All rights reserved. Copying, modifying, redistributing, or reposting without permission is prohibited. See LICENSE for details.
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
  rankHard:   ['ランキング(むずかしい)', 'RANKING (HARD)', '排行榜(困难)', '랭킹(어려움)'],
  rankShowHard: ['むずかしいを見る', 'SHOW HARD', '查看困难', '어려움 보기'],
  rankShowNormal: ['ふつうを見る', 'SHOW NORMAL', '查看普通', '보통 보기'],
  zukan:      ['ずかん', 'BESTIARY', '图鉴', '도감'],
  zCards:     ['ルネリアのカード', 'Luneria Cards', '露内莉亚卡片', '루네리아 카드'],
  zLocked:    ['ステージを{n}回クリアで開封', 'Clear stages {n} time(s) to unlock', '过关{n}次后解锁', '스테이지를 {n}번 클리어하면 열림'],
  zAllies:    ['なかま', 'Allies', '伙伴', '동료'],
  zEnemies:   ['てき', 'Enemies', '敌人', '적'],
  zNone:      ['まだ出会っていません', 'None met yet', '还没有遇到', '아직 만나지 못했어요'],
  regTitle:   ['ランキング登録', 'SUBMIT SCORE', '登记成绩', '랭킹 등록'],
  regBtn:     ['登録する', 'SUBMIT', '登记', '등록하기'],
  yourName:   ['なまえ(12文字まで)', 'Your name (up to 12)', '名字(最多12字)', '이름(12자까지)'],
  needName:   ['なまえを入れてください', 'Please enter your name', '请输入名字', '이름을 입력해 주세요'],
  sending:    ['送信中...', 'Sending...', '发送中...', '보내는 중...'],
  rankIs:     ['{n}位になりました!', 'You are #{n}!', '第{n}名!', '{n}위입니다!'],
  notBest:    ['自己ベスト({b}点)を超えていないので、登録されませんでした', 'Not registered: this did not beat your best ({b})', '未超过个人最佳({b}分),未登记', '자기 최고 기록({b}점)을 넘지 못해 등록되지 않았어요'],
  notTop:     ['100位に届きませんでした', 'Not in the top 100', '未进入前100名', '100위 안에 들지 못했어요'],
  tooFast:    ['少し時間をおいてから登録してください', 'Please wait a moment and try again', '请稍后再试', '잠시 후에 다시 등록해 주세요'],
  tooMany:    ['この端末から登録できる名前の数を超えました', 'Too many names from this device', '此设备登记的名字太多了', '이 기기에서 등록할 수 있는 이름 수를 넘었어요'],
  rankFail:   ['ランキングサーバーにつながりませんでした', 'Could not reach the ranking server', '无法连接排行榜服务器', '랭킹 서버에 연결할 수 없었어요'],
  loading:    ['読み込み中...', 'Loading...', '读取中...', '불러오는 중...'],
  rankEmpty:  ['まだ記録がありません', 'No scores yet', '还没有记录', '아직 기록이 없어요'],
  settings:   ['せってい', 'SETTINGS', '设置', '설정'],
  howto:      ['あそびかた', 'HOW TO PLAY', '玩法', '플레이 방법'],
  titleHint:  ['↑↓←→で えらんで ＥＮＴＥＲ', '↑↓←→ to choose, ENTER to select', '↑↓←→选择  ENTER确定', '↑↓←→로 선택, ENTER로 결정'],
  // メニュー
  menu:       ['メニュー', 'MENU', '菜单', '메뉴'],
  confirm:    ['かくにん', 'CONFIRM', '确认', '확인'],
  cancel:     ['やめる', 'CANCEL', '取消', '취소'],
  qToTitle:   ['今のゲームを終わらせて、タイトルにもどりますか?', 'End the current game and return to the title?', '要结束当前游戏并返回标题吗?', '지금 게임을 끝내고 타이틀로 돌아갈까요?'],
  qRestart:   ['今のゲームを終わらせて、最初からやり直しますか?', 'End the current game and start over?', '要结束当前游戏并重新开始吗?', '지금 게임을 끝내고 처음부터 다시 할까요?'],
  qNewGame:   ['途中までのデータが消えます。最初から始めますか?(「つづきから」はできなくなります)', 'Your saved progress will be deleted. Start a new game? (You will not be able to continue.)', '中途存档将被删除。要从头开始吗?(将无法继续游戏)', '이어하기 데이터가 지워집니다. 처음부터 시작할까요? (이어하기를 할 수 없게 됩니다)'],
  hControls:  ['操作', 'Controls', '操作', '조작'],
  hRules:     ['遊び方', 'How to play', '玩法', '플레이 방법'],
  hScore:     ['得点', 'Score', '得分', '점수'],
  close:      ['とじる', 'CLOSE', '关闭', '닫기'],
  resume:     ['つづける', 'RESUME', '继续', '계속하기'],
  restart:    ['リスタート', 'RESTART', '重新开始', '다시 시작'],
  toTitle:    ['タイトルへ', 'TITLE', '返回标题', '타이틀로'],
  bgm:        ['ＢＧＭ: ', 'BGM: ', 'BGM: ', 'BGM: '],
  on:         ['オン', 'ON', '开', '켬'],
  off:        ['オフ', 'OFF', '关', '끔'],
  controls:   ['そうさ: ', 'CONTROLS: ', '操作: ', '조작: '],
  autoPot:    ['自動ポーション: ', 'AUTO POTION: ', '自动药水: ', '자동 물약: '],
  flick:      ['フリック', 'FLICK', '滑动', '플릭'],
  buttons:    ['ボタン', 'BUTTONS', '按钮', '버튼'],
  language:   ['Language: ', 'Language: ', 'Language: ', 'Language: '],
  diffTitle:  ['むずかしさ', 'DIFFICULTY', '难度', '난이도'],
  diffNormal: ['ふつう', 'NORMAL', '普通', '보통'],
  diffHard:   ['むずかしい', 'HARD', '困难', '어려움'],
  diffMsg:    ['「むずかしい」は、ブロックが速く落ち、敵も強くなります。', 'On HARD, blocks fall faster and enemies are stronger.', '"困难"模式下,方块下落更快,敌人也更强。', '"어려움"에서는 블록이 빨리 떨어지고 적도 강해져요.'],
  keyCfg:     ['キー・コントローラー設定', 'KEYS / CONTROLLER', '按键・手柄设置', '키・컨트롤러 설정'],
  cfgKb:      ['キーボード', 'Keyboard', '键盘', '키보드'],
  cfgPad:     ['コントローラー', 'Controller', '手柄', '컨트롤러'],
  cfgDef:     ['初期設定に戻す', 'Reset to default', '恢复默认', '기본값으로'],
  cfgPress:   ['キーを押してください…', 'Press a key...', '请按键…', '키를 누르세요…'],
  cfgPressPad: ['ボタンを押してください…', 'Press a button...', '请按按钮…', '버튼을 누르세요…'],
  cfgKbNote:  ['変えたい枠を選んでから、新しいキーを押します。Backspace で空にします。Esc で取り消します。Esc(メニュー)・P(ポーズ)・M(BGM)・R(リスタート)は変えられません。',
               'Select a slot, then press the new key. Backspace = clear. Esc = cancel. Esc (menu), P (pause), M (BGM) and R (restart) cannot be changed.',
               '选择要更改的栏,然后按新的键。Backspace 清空,Esc 取消。Esc(菜单)、P(暂停)、M(BGM)、R(重新开始)不能更改。',
               '바꿀 칸을 고른 뒤 새 키를 누르세요. Backspace로 비우고 Esc로 취소합니다. Esc(메뉴)・P(일시정지)・M(BGM)・R(다시 시작)은 바꿀 수 없어요.'],
  cfgPadNote: ['変えたい枠を選んでから、新しいボタンを押します。十字キー・左スティックの左右と下は、いつも移動・1マス落とすです。メニューの中は、十字キーで選び、A で決定、B で戻ります。',
               'Select a slot, then press the new button. The D-pad and left stick always move and drop. In menus: D-pad = select, A = OK, B = back.',
               '选择要更改的栏,然后按新的按钮。十字键和左摇杆的左右与下总是用于移动和下落。菜单中用十字键选择,A 确定,B 返回。',
               '바꿀 칸을 고른 뒤 새 버튼을 누르세요. 십자키와 왼쪽 스틱의 좌우・아래는 항상 이동・내리기입니다. 메뉴에서는 십자키로 고르고 A로 결정, B로 돌아갑니다.'],
  cfgReserved: ['このキーは使えません。ほかのキーにしてください。', 'That key is reserved. Please choose another.', '这个键不能使用,请选择其他键。', '이 키는 쓸 수 없어요. 다른 키를 고르세요.'],
  cfgHelp:    ['これは初期設定のキーです。せっていの「キー・コントローラー設定」で変えられます。', 'These are the default keys. You can change them in Settings > Keys / Controller.', '这是默认按键,可在设置的"按键・手柄设置"中更改。', '기본 키입니다. 설정의 "키・컨트롤러 설정"에서 바꿀 수 있어요.'],
  actLeft:    ['左へ移動', 'Move left', '左移', '왼쪽 이동'],
  actRight:   ['右へ移動', 'Move right', '右移', '오른쪽 이동'],
  actRotL:    ['左回転', 'Rotate left', '左旋转', '왼쪽 회전'],
  actRotR:    ['右回転', 'Rotate right', '右旋转', '오른쪽 회전'],
  actSoft:    ['1マス落とす', 'Drop 1 row', '下落1格', '1칸 내리기'],
  actHard:    ['すぐ落とす', 'Hard drop', '直接落下', '바로 내리기'],
  actSwap:    ['NEXTと入れかえ', 'Swap with NEXT', '与NEXT交换', 'NEXT와 교체'],
  actPotion:  ['ポーション', 'Potion', '药水', '물약'],
  actMoon:    ['月光波', 'Moon wave', '月光波', '월광파'],
  actPause:   ['メニュー', 'Menu', '菜单', '메뉴'],
  actBgm:     ['BGM オン/オフ', 'BGM on/off', 'BGM 开/关', 'BGM 켜기/끄기'],   // どの言語でも英語(読めない言語になっても、戻し方がわかるように)
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
    [['横にドラッグ', '移動'], ['画面の左側 / 右側をタップ', '左回転 / 右回転'], ['画面の下2割をタップ', '1マス落とす(長押しで連続)'], ['下へはじく', 'すぐ落とす'], ['上へはじく', 'NEXTと入れかえ'],
     ['瓶のボタン', 'ポーション(体力回復)'], ['月のボタン', '月光波'], ['上の画面をタップ', 'メニュー(一時停止)']],
    [['Drag sideways', 'Move'], ['Tap left / right', 'Rotate'], ['Tap the bottom 20%', 'Drop 1 row (hold to repeat)'], ['Flick down', 'Hard drop'], ['Flick up', 'Swap with NEXT'],
     ['Bottle button', 'Potion (heal)'], ['Moon button', 'Moon wave'], ['Tap the top screen', 'Menu']],
    [['左右拖动', '移动'], ['点击左侧 / 右侧', '旋转'], ['点击下方两成', '下落1格(长按连续)'], ['向下轻扫', '直接落下'], ['向上轻扫', '与NEXT交换'],
     ['药瓶按钮', '药水(回复)'], ['月亮按钮', '月光波'], ['点击上方画面', '菜单']],
    [['좌우로 드래그', '이동'], ['왼쪽 / 오른쪽 탭', '회전'], ['아래 20% 탭', '1칸 내리기(길게 누르면 연속)'], ['아래로 튕기기', '바로 내리기'], ['위로 튕기기', 'NEXT와 교체'],
     ['병 버튼', '물약(회복)'], ['달 버튼', '월광파'], ['위쪽 화면 탭', '메뉴']],
  ],
  buttons: [
    [['画面下のボタン', '移動・回転・落とす'], ['NEXTをタップ', 'NEXTと入れかえ'], ['瓶のボタン', 'ポーション(体力回復)'], ['月のボタン', '月光波'], ['上の画面をタップ', 'メニュー(一時停止)']],
    [['On-screen buttons', 'Move / rotate / drop'], ['Tap NEXT', 'Swap with NEXT'], ['Bottle button', 'Potion (heal)'], ['Moon button', 'Moon wave'], ['Tap the top screen', 'Menu']],
    [['画面按钮', '移动・旋转・落下'], ['点击NEXT', '与NEXT交换'], ['药瓶按钮', '药水(回复)'], ['月亮按钮', '月光波'], ['点击上方画面', '菜单']],
    [['화면 버튼', '이동・회전・내리기'], ['NEXT 탭', 'NEXT와 교체'], ['병 버튼', '물약(회복)'], ['달 버튼', '월광파'], ['위쪽 화면 탭', '메뉴']],
  ],
  keys: [
    [['← →', '移動'], ['↑ / X / Z', '回転'], ['↓', '1マス落とす'], ['SPACE', 'すぐ落とす'], ['SHIFT / A / テンキー 7・8・9', 'NEXTと入れかえ'], ['C / テンキー +', 'ポーション(体力回復)'],
     ['V / テンキー ENTER', '月光波'], ['ESC', 'メニュー'], ['P', 'ポーズ'], ['M', 'BGM オン/オフ'], ['R', 'リスタート']],
    [['← →', 'Move'], ['↑ / X / Z', 'Rotate'], ['↓', 'Drop 1 row'], ['SPACE', 'Hard drop'], ['SHIFT / A / Numpad 7 8 9', 'Swap with NEXT'], ['C / Numpad +', 'Potion (heal)'],
     ['V / Numpad ENTER', 'Moon wave'], ['ESC', 'Menu'], ['P', 'Pause'], ['M', 'BGM on/off'], ['R', 'Restart']],
    [['← →', '移动'], ['↑ / X / Z', '旋转'], ['↓', '下落1格'], ['SPACE', '直接落下'], ['SHIFT / A / 小键盘 7 8 9', '与NEXT交换'], ['C / 小键盘 +', '药水(回复)'],
     ['V / 小键盘 ENTER', '月光波'], ['ESC', '菜单'], ['P', '暂停'], ['M', 'BGM 开/关'], ['R', '重新开始']],
    [['← →', '이동'], ['↑ / X / Z', '회전'], ['↓', '1칸 내리기'], ['SPACE', '바로 내리기'], ['SHIFT / A / 숫자패드 7 8 9', 'NEXT와 교체'], ['C / 숫자패드 +', '물약(회복)'],
     ['V / 숫자패드 ENTER', '월광파'], ['ESC', '메뉴'], ['P', '일시정지'], ['M', 'BGM 켜기/끄기'], ['R', '다시 시작']],
  ],
  notes: [
    ['ミノについている卵の上に、別のミノの卵を重ねると「水玉の卵」になります。', '水玉の卵がある横の列を消すと、卵からモンスターが生まれて、敵と戦います。', 'ラインを消すと、ポーション(体力回復)と月光波(敵全体への攻撃)がたまります。', '敵がルネリアのところまで来るか、ルネリアの体力が0になると負けです。ブロックが一番上まで積み上がっても負けです。', 'ボスを倒すとステージクリア。全7ステージです。'],
    ['Drop a piece so its egg lands on another egg to make a polka-dot egg.', 'Clear a row with polka-dot eggs and monsters hatch to fight the enemies.', 'Clearing lines fills the potion (heal) and the moon wave (hits all enemies).', 'You lose if an enemy reaches Luneria, her HP hits 0, or the blocks reach the top.', 'Defeat the boss to clear the stage. There are 7 stages.'],
    ['把方块上的蛋叠在另一个蛋上,就会变成"水玉蛋"。', '消除有水玉蛋的横行,蛋会孵出怪物,和敌人战斗。', '消行会积攒药水(回复体力)和月光波(攻击全部敌人)。', '敌人走到露内莉亚身边、她的体力变为0、或方块堆到顶时,游戏失败。', '打倒首领即可过关,共7关。'],
    ['블록의 알 위에 다른 블록의 알을 겹치면 "물방울 알"이 됩니다.', '물방울 알이 있는 줄을 지우면 알에서 몬스터가 태어나 적과 싸워요.', '줄을 지우면 물약(체력 회복)과 월광파(적 전체 공격)가 모여요.', '적이 루네리아에게 닿거나, 체력이 0이 되거나, 블록이 맨 위까지 쌓이면 패배예요.', '보스를 쓰러뜨리면 스테이지 클리어. 모두 7스테이지입니다.'],
  ],
  // 得点: [内容, 点数]
  score: [
    [['ラインを消す', '10 × 2^(n−1) 点(n = 消したライン数 + 水玉の卵の数)'], ['', '例: 1ライン 10点 / 2ライン 20点 / 1ライン+水玉の卵2個 40点'], ['ザコを倒す', '50 × ステージ番号'], ['ボスを倒す', '500 × ステージ番号'], ['ステージクリア', '3000 × ステージ番号'], ['全ステージクリア', '+10000']],
    [['Clear lines', '10 × 2^(n−1) (n = lines + polka-dot eggs)'], ['', 'e.g. 1 line 10 / 2 lines 20 / 1 line + 2 eggs 40'], ['Defeat a minion', '50 × stage'], ['Defeat the boss', '500 × stage'], ['Stage clear', '3000 × stage'], ['All stages clear', '+10000']],
    [['消行', '10 × 2^(n−1) 分(n = 消除行数 + 水玉蛋数)'], ['', '例: 1行 10分 / 2行 20分 / 1行+水玉蛋2个 40分'], ['打倒小怪', '50 × 关卡'], ['打倒首领', '500 × 关卡'], ['过关', '3000 × 关卡'], ['全部通关', '+10000']],
    [['줄 지우기', '10 × 2^(n−1)점 (n = 지운 줄 수 + 물방울 알 수)'], ['', '예: 1줄 10점 / 2줄 20점 / 1줄+물방울 알 2개 40점'], ['잡몹 쓰러뜨리기', '50 × 스테이지'], ['보스 쓰러뜨리기', '500 × 스테이지'], ['스테이지 클리어', '3000 × 스테이지'], ['모든 스테이지 클리어', '+10000']],
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
