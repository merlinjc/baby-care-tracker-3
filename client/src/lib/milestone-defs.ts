/**
 * 里程碑定义数据
 * 从小程序 packageGrowth/config/milestone-defs.js 移植
 * 基于 WHO 和 CDC 发育里程碑标准
 */

export interface MilestoneItem {
  name: string
  window: string
  whoWindow: string
  description: string
  standard: 'WHO' | 'CDC'
  warningMonths: number
  howToHelp: string
}

export interface MilestoneCategory {
  category: string
  icon: string
  items: MilestoneItem[]
}

export const MILESTONE_DEFINITIONS: MilestoneCategory[] = [
  {
    category: '大运动',
    icon: 'running',
    items: [
      { name: '抬头', window: '1.0-3.6月', whoWindow: '1.0-3.6月', description: '俯卧时能抬头90度', standard: 'WHO', warningMonths: 4, howToHelp: '每天让宝宝趴3-5次，每次3-5分钟，逐渐延长；用色彩鲜艳的玩具或黑白卡在宝宝前方吸引抬头；竖抱时轻托下巴，让宝宝自然练习头部控制；和宝宝面对面趴着互动，增加趣味性' },
      { name: '翻身', window: '3.0-6.5月', whoWindow: '3.0-6.5月', description: '从仰卧翻到俯卧', standard: 'WHO', warningMonths: 7, howToHelp: '将玩具放在宝宝身体一侧吸引翻转；轻轻将宝宝一条腿搭过另一条，帮助体验翻身动作；给宝宝穿宽松衣物，减少翻身阻力；多做左右两侧的练习，促进均衡发展' },
      { name: '独坐', window: '3.8-9.2月', whoWindow: '3.8-9.2月', description: '不需要支撑能坐稳', standard: 'WHO', warningMonths: 10, howToHelp: '先让宝宝靠在枕头或大人身上练习坐姿，逐渐减少支撑；在宝宝周围放软垫防摔，让宝宝安心练习；坐着时递玩具给宝宝，锻炼坐姿平衡能力；避免长时间使用婴儿座椅，多给自主练习的机会' },
      { name: '爬行', window: '5.4-10.2月', whoWindow: '5.4-10.2月', description: '手膝爬行，能向前移动', standard: 'WHO', warningMonths: 12, howToHelp: '在地垫上让宝宝多趴，将喜欢的玩具放在前方一点距离吸引移动；用毛巾托住宝宝肚子帮助体验四肢撑地的感觉；家长在前方爬给宝宝看，做示范和鼓励；确保爬行区域安全，让宝宝自由探索' },
      { name: '扶站', window: '4.8-11.4月', whoWindow: '4.8-11.4月', description: '扶着家具能站立', standard: 'WHO', warningMonths: 13, howToHelp: '让宝宝扶着沙发、矮茶几等稳固家具练习站立；在家具上放有趣的玩具，激发站起来的动力；家长双手扶着宝宝腋下，让宝宝感受站立的感觉；确保家具不会倾倒，做好防撞角保护' },
      { name: '独站', window: '6.9-16.9月', whoWindow: '6.9-16.9月', description: '不扶物能独立站立', standard: 'WHO', warningMonths: 18, howToHelp: '当宝宝扶站稳后，轻轻松开双手让宝宝短暂独站；给宝宝双手各拿一个玩具，自然放开扶持物；和宝宝面对面互相拍手，分散注意力让宝宝自然站稳；不要催促，给宝宝充足的自信心建立时间' },
      { name: '独走', window: '8.2-14.8月', whoWindow: '8.2-14.8月', description: '不扶物能独立行走', standard: 'WHO', warningMonths: 18, howToHelp: '让宝宝推着小推车或稳固的椅子练习行走；家长蹲在几步远的地方张开手臂鼓励宝宝走过来；在两个大人之间让宝宝来回走动，逐渐加大距离；选择防滑地面或赤脚练习，帮助宝宝更好地感知平衡' },
    ],
  },
  {
    category: '精细动作',
    icon: 'hand',
    items: [
      { name: '伸手抓物', window: '3.0-5.0月', whoWindow: '3.0-5.0月', description: '主动伸手抓取物品', standard: 'WHO', warningMonths: 6, howToHelp: '将颜色鲜艳或会发声的玩具放在宝宝伸手可及的地方；轻轻将玩具碰触宝宝手掌，激发抓握意识；悬挂床铃让宝宝练习伸手触碰；选择不同质地的玩具（软的、硬的、粗糙的），丰富触觉体验' },
      { name: '传递物品', window: '4.5-7.5月', whoWindow: '4.5-7.5月', description: '物品从一手传到另一手', standard: 'WHO', warningMonths: 8, howToHelp: '先给宝宝一只手一个玩具，再把另一个递到另一只手旁；和宝宝玩"给我—还你"的传递游戏；选择大小适合宝宝双手握持的玩具来练习；用夸张的表情和语气鼓励每一次成功的传递' },
      { name: '拇食指捏取', window: '7.5-11.0月', whoWindow: '7.5-11.0月', description: '用拇指和食指捏取小物品', standard: 'WHO', warningMonths: 12, howToHelp: '在餐盘里放泡芙、小星星饼干等让宝宝自主捏取；玩捡豆子放杯子的游戏（需大人看护防误吞）；撕纸游戏也能很好地锻炼手指灵活性；用手指食物代替勺喂，在吃饭时自然练习精细抓握' },
      { name: '对敲积木', window: '8.0-12.0月', whoWindow: '8.0-12.0月', description: '双手各拿一块积木对敲', standard: 'CDC', warningMonths: 14, howToHelp: '大人先示范用两块积木对敲发出声音，吸引宝宝模仿；把积木递到宝宝双手中引导对击；也可以用小沙锤、木质勺子等替代练习；敲击时配合节奏说"砰砰砰"，增加互动乐趣' },
    ],
  },
  {
    category: '语言',
    icon: 'comments',
    items: [
      { name: '发出咕咕声', window: '2.0-4.0月', whoWindow: '2.0-4.0月', description: '发出"咕咕"等声音', standard: 'WHO', warningMonths: 5, howToHelp: '面对面和宝宝说话，当宝宝发出声音时用相同的声音回应；给宝宝唱轻柔的儿歌和童谣；换尿布、喂奶时描述正在做的事情，保持语言输入；等宝宝"说完"再回应，建立对话轮流的意识' },
      { name: '咿呀学语', window: '4.0-7.0月', whoWindow: '4.0-7.0月', description: '发出"ba-ba"等音节', standard: 'WHO', warningMonths: 8, howToHelp: '重复宝宝发出的音节（如宝宝说"ba"，你也说"ba-ba"）；用夸张的嘴型说简单音节让宝宝观察模仿；每天念绘本给宝宝听，指着图片说出名称；减少电子屏幕使用，多进行面对面的语言互动' },
      { name: '理解简单指令', window: '7.0-10.0月', whoWindow: '7.0-10.0月', description: '理解"不可以"等简单指令', standard: 'CDC', warningMonths: 12, howToHelp: '说指令时配合手势（如说"过来"时张开双臂），帮助宝宝理解；日常生活中反复使用固定短语（如"吃饭啦""洗手"）；玩"摸鼻子、摸耳朵"的游戏练习听指令；语速放慢、语调夸张，确保宝宝能注意到关键词' },
      { name: '有意识地叫人', window: '9.5-14.0月', whoWindow: '9.5-14.0月', description: '有意识地叫"妈妈""爸爸"', standard: 'WHO', warningMonths: 16, howToHelp: '指着妈妈说"妈妈"、指着爸爸说"爸爸"，反复强化人称对应关系；当宝宝发出类似"mama"的音时热情回应，正向强化；翻看家庭照片时指认家人并说出称呼；全家配合，让宝宝明白每个称呼对应谁' },
    ],
  },
  {
    category: '社交',
    icon: 'baby',
    items: [
      { name: '社会性微笑', window: '1.0-3.0月', whoWindow: '1.0-3.0月', description: '对人微笑', standard: 'WHO', warningMonths: 4, howToHelp: '经常面对面和宝宝对视，用温柔的表情和声音互动；做夸张的面部表情（如大笑、惊喜），吸引宝宝回应；抚触和拥抱时多微笑，建立安全感和情感连接；让不同家庭成员参与互动，丰富宝宝的社交体验' },
      { name: '认生', window: '6.0-9.0月', whoWindow: '6.0-9.0月', description: '对陌生人表现出警惕', standard: 'CDC', warningMonths: 10, howToHelp: '这是正常的情感发展表现，说明宝宝能区分亲人和陌生人了；遇到陌生人时抱着宝宝，给宝宝安全感和过渡时间；让陌生人先和家长正常交流，宝宝观察后会逐渐放松；避免强迫宝宝让陌生人抱，尊重宝宝的节奏' },
      { name: '挥手再见', window: '8.0-12.0月', whoWindow: '8.0-12.0月', description: '模仿挥手动作', standard: 'CDC', warningMonths: 14, howToHelp: '每次有人离开时都挥手并说"拜拜"，让宝宝反复观察；握着宝宝的手做挥手动作，帮助建立身体记忆；在视频通话结束时练习挥手再见，增加练习机会；宝宝成功挥手时给予热情鼓掌，正向激励' },
      { name: '指物表达需求', window: '9.0-13.0月', whoWindow: '9.0-13.0月', description: '用手指指向想要的物品', standard: 'CDC', warningMonths: 15, howToHelp: '经常用手指着物品说出名称，做指认示范；当宝宝用眼神看某样东西时，引导宝宝伸手去指；提供选择机会（如"要苹果还是香蕉？"），等宝宝指向其中一个再给；外出散步时指着花草小动物说名称，鼓励宝宝也伸手去指' },
    ],
  },
  {
    category: '认知',
    icon: 'brain',
    items: [
      { name: '追视移动物体', window: '1.0-3.0月', whoWindow: '1.0-3.0月', description: '眼睛能跟踪移动的物体', standard: 'WHO', warningMonths: 4, howToHelp: '用红色小球或黑白对比卡在宝宝眼前20-30cm处缓慢左右移动；摇拨浪鼓在不同位置吸引宝宝视线转移；和宝宝面对面，缓慢左右移动自己的脸；每次练习1-2分钟即可，避免宝宝视觉疲劳' },
      { name: '寻找声源', window: '3.0-6.0月', whoWindow: '3.0-6.0月', description: '能转头寻找声音来源', standard: 'CDC', warningMonths: 7, howToHelp: '在宝宝左右两侧轻摇铃铛或拨浪鼓，等宝宝转头寻找；叫宝宝名字从不同方向，观察宝宝的反应；播放轻柔音乐时移动音源位置；玩"声音在哪里"的游戏，家人在不同位置说话让宝宝找' },
      { name: '物体恒存', window: '6.0-9.0月', whoWindow: '6.0-9.0月', description: '知道物体被遮挡后仍然存在', standard: 'CDC', warningMonths: 10, howToHelp: '玩躲猫猫游戏（用手或毛巾遮脸再露出），让宝宝理解"消失又出现"；把玩具用布部分遮住，让宝宝拉开布找到；当着宝宝的面把玩具藏在杯子下，鼓励宝宝去掀开；和宝宝玩"藏起来找一找"的寻宝游戏' },
      { name: '模仿动作', window: '6.0-12.0月', whoWindow: '6.0-12.0月', description: '能模仿大人的简单动作', standard: 'CDC', warningMonths: 14, howToHelp: '面对面做拍手、摇头、伸舌头等简单动作，等宝宝模仿；唱带动作的儿歌（如"拍拍手、跺跺脚"）一起做；吃饭时示范用勺子的动作让宝宝观察学习；重复同一动作多次，给宝宝充分的观察和练习机会' },
      { name: '用杯子喝水', window: '9.0-15.0月', whoWindow: '9.0-15.0月', description: '能用杯子自己喝水', standard: 'CDC', warningMonths: 18, howToHelp: '从鸭嘴杯过渡到吸管杯，再到敞口杯，循序渐进；先在杯中放少量水让宝宝练习，减少洒出的挫败感；吃饭时让宝宝看大人用杯子喝水，鼓励模仿；选择双耳防摔学饮杯，方便宝宝自己握持' },
    ],
  },
]

export const MILESTONE_CATEGORIES = MILESTONE_DEFINITIONS.map((d) => d.category)

/** Get category key from Chinese category name */
export function getCategoryKey(category: string): string {
  const map: Record<string, string> = {
    '大运动': 'motor',
    '精细动作': 'fine_motor',
    '语言': 'language',
    '社交': 'social',
    '认知': 'cognitive',
  }
  return map[category] || category
}

/** Get Chinese category name from key */
export function getCategoryLabel(key: string): string {
  const map: Record<string, string> = {
    motor: '大运动',
    fine_motor: '精细动作',
    language: '语言',
    social: '社交',
    cognitive: '认知',
  }
  return map[key] || key
}
