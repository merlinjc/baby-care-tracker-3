/**
 * 疫苗接种计划配置
 * 从小程序 packageGrowth/config/vaccine-plans.js 移植
 * 数据来源：中国疾控中心《国家免疫规划疫苗儿童免疫程序（2025年版）》
 */

export interface VaccinePlanItem {
  name: string
  dose: string
  monthAge: number
  plannedDateOffsetDays: number
  description: string
  site?: string
  precautions?: string
  contraindications?: string
  note?: string
  isFree: boolean
}

interface VaccineAgeGroup {
  age: string
  monthAge: number
  vaccines: VaccinePlanItem[]
}

function addDays(birthDate: Date, days: number): Date {
  return new Date(birthDate.getTime() + days * 24 * 60 * 60 * 1000)
}

const VACCINE_PLAN_TEMPLATE: VaccineAgeGroup[] = [
  {
    age: '出生时',
    monthAge: 0,
    vaccines: [
      { name: '卡介苗', dose: '1剂', monthAge: 0, plannedDateOffsetDays: 0, description: '预防结核病，出生后24小时内接种', site: '左上臂三角肌外下缘皮内注射', precautions: '接种后局部可能出现红肿、化脓，属正常反应，保持干燥即可', contraindications: '出生体重<2500g、严重先天性疾病、免疫缺陷者禁忌', isFree: true },
      { name: '乙肝疫苗', dose: '第1剂', monthAge: 0, plannedDateOffsetDays: 0, description: '预防乙型肝炎，出生后24小时内接种', site: '大腿前部外侧或上臂三角肌肌内注射', precautions: '母亲HBsAg阳性者需同时注射乙肝免疫球蛋白', contraindications: '对疫苗成分过敏者禁忌', isFree: true },
    ],
  },
  {
    age: '1月龄',
    monthAge: 1,
    vaccines: [
      { name: '乙肝疫苗', dose: '第2剂', monthAge: 1, plannedDateOffsetDays: 30, description: '预防乙型肝炎', site: '大腿前部外侧或上臂三角肌肌内注射', precautions: '与第1剂间隔至少28天', isFree: true },
    ],
  },
  {
    age: '2月龄',
    monthAge: 2,
    vaccines: [
      { name: '脊灰疫苗', dose: '第1剂', monthAge: 2, plannedDateOffsetDays: 60, description: '预防脊髓灰质炎，口服减毒活疫苗', site: '口服', precautions: '接种前、后30分钟内避免热饮和哺乳', note: 'bOPV', isFree: true },
      { name: '肺炎疫苗', dose: '第1剂', monthAge: 2, plannedDateOffsetDays: 60, description: '预防肺炎链球菌感染', site: '大腿前部外侧肌内注射', precautions: '属于二类疫苗，自愿自费接种', note: '自费', isFree: false },
      { name: '轮状病毒疫苗', dose: '第1剂', monthAge: 2, plannedDateOffsetDays: 60, description: '预防轮状病毒腹泻', site: '口服', precautions: '属于二类疫苗，自愿自费接种', note: '自费', isFree: false },
    ],
  },
  {
    age: '3月龄',
    monthAge: 3,
    vaccines: [
      { name: '百白破疫苗', dose: '第1剂', monthAge: 3, plannedDateOffsetDays: 90, description: '预防百日咳、白喉、破伤风', site: '大腿前部外侧或上臂三角肌肌内注射', precautions: '接种后可能出现发热、局部红肿，一般1-2天自行消退', note: '2025年新程序', isFree: true },
      { name: '脊灰疫苗', dose: '第2剂', monthAge: 3, plannedDateOffsetDays: 90, description: '预防脊髓灰质炎', site: '口服', precautions: '接种前、后30分钟内避免热饮和哺乳', note: 'bOPV', isFree: true },
      { name: '肺炎疫苗', dose: '第2剂', monthAge: 3, plannedDateOffsetDays: 90, description: '预防肺炎链球菌感染', site: '大腿前部外侧肌内注射', note: '自费', isFree: false },
    ],
  },
  {
    age: '4月龄',
    monthAge: 4,
    vaccines: [
      { name: '百白破疫苗', dose: '第2剂', monthAge: 4, plannedDateOffsetDays: 120, description: '预防百日咳、白喉、破伤风', site: '大腿前部外侧或上臂三角肌肌内注射', note: '2025年新程序', isFree: true },
      { name: '脊灰疫苗', dose: '第3剂', monthAge: 4, plannedDateOffsetDays: 120, description: '预防脊髓灰质炎', site: '口服', note: 'bOPV', isFree: true },
      { name: '肺炎疫苗', dose: '第3剂', monthAge: 4, plannedDateOffsetDays: 120, description: '预防肺炎链球菌感染', site: '大腿前部外侧肌内注射', note: '自费', isFree: false },
    ],
  },
  {
    age: '5月龄',
    monthAge: 5,
    vaccines: [
      { name: '百白破疫苗', dose: '第3剂', monthAge: 5, plannedDateOffsetDays: 150, description: '预防百日咳、白喉、破伤风', site: '大腿前部外侧或上臂三角肌肌内注射', note: '2025年新程序', isFree: true },
    ],
  },
  {
    age: '6月龄',
    monthAge: 6,
    vaccines: [
      { name: '乙肝疫苗', dose: '第3剂', monthAge: 6, plannedDateOffsetDays: 180, description: '预防乙型肝炎', site: '大腿前部外侧或上臂三角肌肌内注射', isFree: true },
      { name: '流脑A群', dose: '第1剂', monthAge: 6, plannedDateOffsetDays: 180, description: '预防A群脑膜炎球菌引起的流脑', site: '上臂外侧三角肌附着处皮下注射', precautions: '两剂间隔至少3个月', isFree: true },
      { name: '流感疫苗', dose: '第1剂', monthAge: 6, plannedDateOffsetDays: 180, description: '预防流行性感冒', site: '大腿前部外侧或上臂三角肌肌内注射', note: '自费', precautions: '6月龄-8岁首次接种需2剂，间隔4周', isFree: false },
    ],
  },
  {
    age: '8月龄',
    monthAge: 8,
    vaccines: [
      { name: '麻腮风疫苗', dose: '第1剂', monthAge: 8, plannedDateOffsetDays: 240, description: '预防麻疹、流行性腮腺炎、风疹', site: '上臂外侧三角肌下缘附着处皮下注射', precautions: '接种后6-10天可能出现发热、皮疹，属正常反应', note: '2025年新程序', isFree: true },
      { name: '乙脑减毒活疫苗', dose: '第1剂', monthAge: 8, plannedDateOffsetDays: 240, description: '预防流行性乙型脑炎', site: '上臂外侧三角肌下缘附着处皮下注射', precautions: '接种后可能出现发热，一般不超过38.5°C', isFree: true },
    ],
  },
  {
    age: '9月龄',
    monthAge: 9,
    vaccines: [
      { name: '流脑A群', dose: '第2剂', monthAge: 9, plannedDateOffsetDays: 270, description: '预防A群脑膜炎球菌引起的流脑', site: '上臂外侧三角肌附着处皮下注射', isFree: true },
      { name: '流感疫苗', dose: '第2剂', monthAge: 9, plannedDateOffsetDays: 268, description: '预防流行性感冒', site: '大腿前部外侧或上臂三角肌肌内注射', note: '自费', isFree: false },
    ],
  },
  {
    age: '12月龄',
    monthAge: 12,
    vaccines: [
      { name: '乙脑减毒活疫苗', dose: '第2剂', monthAge: 12, plannedDateOffsetDays: 365, description: '预防流行性乙型脑炎', site: '上臂外侧三角肌下缘附着处皮下注射', isFree: true },
      { name: '水痘疫苗', dose: '第1剂', monthAge: 12, plannedDateOffsetDays: 365, description: '预防水痘', site: '上臂外侧三角肌附着处皮下注射', note: '自费', precautions: '接种后可能出现轻微水痘样皮疹，属正常反应', isFree: false },
      { name: '肺炎疫苗', dose: '第4剂', monthAge: 12, plannedDateOffsetDays: 365, description: '预防肺炎链球菌感染（加强针）', site: '大腿前部外侧或上臂三角肌肌内注射', note: '自费', isFree: false },
    ],
  },
  {
    age: '18月龄',
    monthAge: 18,
    vaccines: [
      { name: '百白破疫苗', dose: '第4剂', monthAge: 18, plannedDateOffsetDays: 540, description: '预防百日咳、白喉、破伤风（加强针）', site: '上臂三角肌肌内注射', note: '2025年新程序', isFree: true },
      { name: '麻腮风疫苗', dose: '第2剂', monthAge: 18, plannedDateOffsetDays: 540, description: '预防麻疹、流行性腮腺炎、风疹', site: '上臂外侧三角肌下缘附着处皮下注射', note: '2025年新程序', isFree: true },
      { name: '甲肝减毒活疫苗', dose: '1剂', monthAge: 18, plannedDateOffsetDays: 540, description: '预防甲型肝炎', site: '上臂外侧三角肌附着处皮下注射', isFree: true },
    ],
  },
]

export interface VaccinePlanWithDate extends VaccinePlanItem {
  plannedDate: string
}

/**
 * 生成疫苗接种计划（基于出生日期计算接种日期）
 */
export function getVaccinePlans(birthDate: string): VaccinePlanWithDate[] {
  const birth = new Date(birthDate)
  const plans: VaccinePlanWithDate[] = []

  for (const group of VACCINE_PLAN_TEMPLATE) {
    for (const v of group.vaccines) {
      const plannedDate = addDays(birth, v.plannedDateOffsetDays)
      plans.push({
        ...v,
        plannedDate: plannedDate.toISOString().split('T')[0],
      })
    }
  }

  return plans
}

export const VACCINE_CATEGORIES = {
  FREE: '一类疫苗（免费）',
  PAID: '二类疫苗（自费）',
} as const
