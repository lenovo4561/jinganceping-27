import { personalityTestData } from './xingge'
import { careerPersonalityTest } from './shiye'
import { lovePersonalityTest } from './aiqing'
import { funQuizTest } from './quwei'
import { mentalHealthTest } from './xinlizhuangtai'
import { depressionRiskAssessment } from './yiyufengxian'
import { anxietyAssessmentTest } from './jiaolu'

const REMEN_SOURCE_CONFIG = {
  xingge: {
    key: 'xingge',
    tab: '性格',
    tag: '性格',
    imagePrefix: '/pkg_main/assets/img/cp/xg/',
    data: personalityTestData
  },
  shiye: {
    key: 'shiye',
    tab: '事业',
    tag: '事业',
    imagePrefix: '/pkg_main/assets/img/cp/sy/',
    data: careerPersonalityTest
  },
  aiqing: {
    key: 'aiqing',
    tab: '爱情',
    tag: '爱情',
    imagePrefix: '/pkg_main/assets/img/cp/aq/',
    data: lovePersonalityTest
  },
  quwei: {
    key: 'quwei',
    tab: '趣味',
    tag: '趣味',
    imagePrefix: '/pkg_main/assets/img/cp/qw/',
    data: funQuizTest
  },
  xinlizhuangtai: {
    key: 'xinlizhuangtai',
    data: mentalHealthTest,
    dataMode: 'single'
  },
  yiyufengxian: {
    key: 'yiyufengxian',
    data: depressionRiskAssessment,
    dataMode: 'single'
  },
  jiaolu: {
    key: 'jiaolu',
    data: anxietyAssessmentTest,
    dataMode: 'single'
  }
}

const REMEN_SOURCE_ORDER = ['xingge', 'shiye', 'aiqing', 'quwei']

function getRemenTabs() {
  return REMEN_SOURCE_ORDER.map(function(key) {
    const cfg = REMEN_SOURCE_CONFIG[key]
    return { key: cfg.key, title: cfg.tab }
  })
}

function getRemenListBySource(source) {
  const cfg = REMEN_SOURCE_CONFIG[source]
  if (!cfg || !cfg.data || !Array.isArray(cfg.data.testList)) return []

  return cfg.data.testList.map(function(item) {
    return {
      id: item.id,
      title: item.name,
      tag: cfg.tag,
      source: source,
      image: cfg.imagePrefix + String(item.id) + '.jpg'
    }
  })
}

function getRemenTestBySourceAndId(source, id) {
  const cfg = REMEN_SOURCE_CONFIG[source]
  if (!cfg || !cfg.data) return null

  const targetId = parseInt(id, 10)
  if (isNaN(targetId)) return null

  if (cfg.dataMode === 'single') {
    return targetId === 1 ? cfg.data : null
  }

  if (!Array.isArray(cfg.data.testList)) return null

  for (let i = 0; i < cfg.data.testList.length; i++) {
    if (cfg.data.testList[i].id === targetId) return cfg.data.testList[i]
  }
  return null
}

function mapQuestionToView(question) {
  const options = question && question.options ? question.options : {}
  return {
    question: question && question.title ? question.title : '',
    opts: [options.A || '', options.B || '', options.C || '', options.D || '']
  }
}

function getRemenQuestions(source, id) {
  const test = getRemenTestBySourceAndId(source, id)
  if (!test || !Array.isArray(test.questions)) return []
  return test.questions.map(mapQuestionToView)
}

function getRangeMatch(levelList, score) {
  if (!Array.isArray(levelList)) return null
  for (let i = 0; i < levelList.length; i++) {
    const item = levelList[i]
    if (!item || !Array.isArray(item.range) || item.range.length !== 2) continue
    if (score >= item.range[0] && score <= item.range[1]) return item
  }
  return null
}

function calcSinglePsychResult(test, answerIndices, source) {
  const rule = test && test.scoreRule ? test.scoreRule : {}
  const optionScore = rule.optionScore || { A: 1, B: 2, C: 3, D: 4 }
  let total = 0

  for (let i = 0; i < answerIndices.length; i++) {
    const idx = answerIndices[i]
    if (typeof idx !== 'number' || idx < 0) {
      return { success: false, message: '答题数据无效' }
    }
    const key =
      idx === 0 ? 'A' : idx === 1 ? 'B' : idx === 2 ? 'C' : idx === 3 ? 'D' : ''
    if (!key || typeof optionScore[key] !== 'number') {
      return { success: false, message: '答题数据无效' }
    }
    total += optionScore[key]
  }

  if (Array.isArray(rule.dimensions) && rule.dimensions.length > 0) {
    const sectionList = []
    for (let i = 0; i < rule.dimensions.length; i++) {
      const dim = rule.dimensions[i]
      if (
        !dim ||
        !Array.isArray(dim.questionRange) ||
        dim.questionRange.length !== 2
      )
        continue
      const start = dim.questionRange[0] - 1
      const end = dim.questionRange[1] - 1
      let dimScore = 0
      for (let q = start; q <= end; q++) {
        const ansIdx = answerIndices[q]
        const optKey =
          ansIdx === 0
            ? 'A'
            : ansIdx === 1
            ? 'B'
            : ansIdx === 2
            ? 'C'
            : ansIdx === 3
            ? 'D'
            : ''
        if (optKey && typeof optionScore[optKey] === 'number') {
          dimScore += optionScore[optKey]
        }
      }

      const levelHit = getRangeMatch(dim.scoreLevels, dimScore)
      const levelName = levelHit && levelHit.level ? levelHit.level : '待评估'
      const levelDesc = levelHit && levelHit.desc ? levelHit.desc : ''
      const dimConclusion =
        test.conclusions &&
        test.conclusions[dim.name] &&
        test.conclusions[dim.name][levelName]
          ? test.conclusions[dim.name][levelName]
          : ''
      sectionList.push(
        dim.name +
          '：' +
          levelName +
          (levelDesc ? '（' + levelDesc + '）' : '') +
          (dimConclusion ? '\n' + dimConclusion : '')
      )
    }

    return {
      success: true,
      data: {
        totalScore: total,
        resultTitle: '综合测评结果',
        resultText: sectionList.join('\n\n'),
        testName: (test.testInfo && test.testInfo.name) || '',
        testId: 1,
        testSource: source
      }
    }
  }

  const levels = rule.riskLevels || rule.anxietyLevels || []
  const hit = getRangeMatch(levels, total)
  const levelName = hit && hit.level ? hit.level : ''
  const levelDesc = hit && hit.desc ? hit.desc : ''
  const detail =
    test.conclusions && levelName ? test.conclusions[levelName] : ''

  return {
    success: true,
    data: {
      totalScore: total,
      resultTitle: levelName,
      resultText: (levelDesc ? levelDesc + '\n\n' : '') + (detail || ''),
      testName: (test.testInfo && test.testInfo.name) || '',
      testId: 1,
      testSource: source
    }
  }
}

function getMatchTypeByScore(scoreRule, score) {
  if (!scoreRule) return null
  const typeGroup =
    scoreRule.personalityType || scoreRule.careerType || scoreRule.loveType
  if (!typeGroup) return null

  const keys = Object.keys(typeGroup)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const item = typeGroup[key]
    if (!item || !Array.isArray(item.range) || item.range.length !== 2) continue
    if (score >= item.range[0] && score <= item.range[1]) {
      return { key: key, meta: item }
    }
  }

  return null
}

function calcRemenResult(source, id, answerIndices) {
  const cfg = REMEN_SOURCE_CONFIG[source]
  const test = getRemenTestBySourceAndId(source, id)
  if (!cfg || !cfg.data || !test) {
    return { success: false, message: '测试信息不存在' }
  }

  if (!Array.isArray(answerIndices) || answerIndices.length === 0) {
    return { success: false, message: '答题数据无效' }
  }

  if (cfg.dataMode === 'single') {
    return calcSinglePsychResult(test, answerIndices, source)
  }

  const optionScore = (cfg.data.scoreRule &&
    cfg.data.scoreRule.optionScore) || { A: 1, B: 2, C: 3, D: 4 }
  let total = 0
  for (let i = 0; i < answerIndices.length; i++) {
    const idx = answerIndices[i]
    if (typeof idx !== 'number' || idx < 0) {
      return { success: false, message: '答题数据无效' }
    }
    const optKey =
      idx === 0 ? 'A' : idx === 1 ? 'B' : idx === 2 ? 'C' : idx === 3 ? 'D' : ''
    if (!optKey || typeof optionScore[optKey] !== 'number') {
      return { success: false, message: '答题数据无效' }
    }
    total += optionScore[optKey]
  }

  const match = getMatchTypeByScore(cfg.data.scoreRule, total)
  const conclusion = test.conclusion || {}
  let resultText = ''
  let resultTitle = ''

  if (match && match.key && conclusion[match.key]) {
    resultText = conclusion[match.key]
    resultTitle = match.meta && match.meta.name ? match.meta.name : ''
  } else {
    const keys = Object.keys(conclusion)
    if (keys.length > 0) {
      resultText = conclusion[keys[0]] || ''
      resultTitle = ''
    }
  }

  return {
    success: true,
    data: {
      totalScore: total,
      resultTitle: resultTitle,
      resultText: resultText,
      testName: test.name,
      testId: test.id,
      testSource: source
    }
  }
}

export {
  getRemenTabs,
  getRemenListBySource,
  getRemenTestBySourceAndId,
  getRemenQuestions,
  calcRemenResult
}
