import traffic from 'wt-traffic'
const last = array => array[array.length-1]

export default function(moment) {
  const {  
    getTimeStamps, 
    getDataSum, 
    getTrafficGraphData, 
    getTrafficSpeed,
    simplify
  } = traffic(moment);

  const getSiteAdRatio = (adList, dots, timeStamp, isConverter = false) => adList.reduce((sumRatio, adPacket) => {
    const { moneyRatio, startDate, earned, earnedTs, budget } = adPacket
    const isEnded = earnedTs && earned >= budget
    const endDate = isEnded ? earnedTs : adPacket.endDate
    const inInterval = isConverter 
      ? timeStamp > startDate && timeStamp <= endDate
      : timeStamp >= startDate && timeStamp <= endDate
    const fakePeriodStart = earnedTs || startDate
    const tsInFakePeriod = !isEnded && timeStamp > fakePeriodStart

    let isEndedInFakePeriod = false
    if (inInterval && tsInFakePeriod) {
      const processedMoney = getDataSum(dots, fakePeriodStart, timeStamp) * moneyRatio
      isEndedInFakePeriod = earned + processedMoney > budget
    }

    return sumRatio += inInterval && !isEndedInFakePeriod ? moneyRatio : 0
  }, 0)

  const filterAdList = (adList, fromTs, toTs) => adList.filter(adPacket => {
    const { startDate, endDate } = adPacket
    const fromTsInInterval = fromTs >= startDate && fromTs <= endDate
    const toTsInInterval = toTs >= startDate && toTs <= endDate
    if (fromTsInInterval || toTsInInterval) return adPacket
  })

  const convertToMoney = (adList, dots) => {
    return ({ timeStamp, trafSpeed }) => trafSpeed * getSiteAdRatio(adList, dots, timeStamp, true)
  }

  const getMoneyTodaySum = (adList, dots) => {
    if (!adList || !adList.length || !dots || !dots.length) return 0

    const { timeStartDay, timeNow } = getTimeStamps()
    const filteredAdList = filterAdList(adList, timeStartDay, timeNow)
    const converter = convertToMoney(filteredAdList, dots)

    return getDataSum(dots, timeStartDay, timeNow, converter)
  }

  const getMoneyYesterdaySum = (adList, dots) => {
    if (!adList || !adList.length || !dots || !dots.length) return 0

    const timeStamp = moment().subtract(1, 'day').unix()
    const { timeStartDay, timeEndDay } = getTimeStamps(timeStamp)
    const filteredAdList = filterAdList(adList, timeStartDay, timeEndDay)
    const converter = convertToMoney(filteredAdList, dots)

    return getDataSum(dots, timeStartDay, timeEndDay, converter)
  }

  const getMoneySpeed = (adList, dots, period = 'today') => {
    if (!adList || !adList.length || !dots || !dots.length) return 0

    const timeStamp = period === 'yesterday' ? moment().subtract(1, 'day').unix() : moment().unix()
    return getTrafficSpeed(dots, period).total * getSiteAdRatio(adList, dots, timeStamp)
  }

  const getMoneyGraphData = (adList, dots, period = 'today') => {
    if (!adList || !adList.length || !dots || !dots.length) return []

    return getTrafficGraphData(dots, period).map(dot => ({
      ...dot,
      y: Math.round(dot.y * getSiteAdRatio(adList, dots, dot.ts)),
    }))
  }

  const getMoneyChange = (adList, dots) => {
    if (!adList || !adList.length || !dots || !dots.length) return 0

    const nowSpeed = getMoneySpeed(adList, dots, 'today')
    const yesterdaySpeed = getMoneySpeed(adList, dots, 'yesterday')
    const delta = nowSpeed - yesterdaySpeed
    const equallyDelta = Math.max(5, Math.max(nowSpeed, yesterdaySpeed) * 0.05)

    if (Math.abs(delta) <= equallyDelta) return 0
    if (delta > 0) return 1
    return -1
  }

  const getAdBudget = (adPacket, dots, timeStamp = null) => {
    if (!adPacket || !dots || !dots.length) return 0

    const timeNow = moment().unix()
    const { moneyRatio, earned, budget, startDate } = adPacket
    const earnedTs = adPacket.earnedTs || startDate
    const processedMoney = getDataSum(dots, earnedTs, timeStamp || timeNow) * moneyRatio
    return Math.min(budget, earned + processedMoney)
  }

  const getFakeMoney = (adList, dots, timeStamp = null) => {
    if (!adList || !adList.length || !dots || !dots.length) return 0
    timeStamp = timeStamp|| moment().unix()

    const lastDotTimeStamp = last(dots.sort((a, b) => a.ts - b.ts)).ts
    const filteredAdList = filterAdList(adList, lastDotTimeStamp, timeStamp)
    const converter = convertToMoney(filteredAdList, dots)

    return getDataSum(dots, lastDotTimeStamp, timeStamp, converter)
  }
  
  const getAdMoneyTimeEnd = (adPacket, dots) => {
    const { moneyRatio, startDate, earned, earnedTs, budget, endDate } = adPacket
    if (earnedTs && earned >= budget) return earnedTs
    const fakePeriodStart = earnedTs || startDate

    if (earned + getDataSum(dots, fakePeriodStart, endDate) * moneyRatio <= budget) return endDate

    const restMoney = budget - earned
    let desiredFromTs = fakePeriodStart
    let desiredToTs = endDate
    let desiredTs = null
    let deltaMoney = restMoney
    let isDotNotFound = true

    do {
      desiredTs = (desiredToTs + desiredFromTs) / 2
      deltaMoney = restMoney - getDataSum(dots, fakePeriodStart, desiredTs) * moneyRatio
      isDotNotFound = Math.abs(desiredToTs - desiredFromTs) > 5

      if (deltaMoney >= 0) desiredFromTs = desiredTs
      if (deltaMoney <= 0) desiredToTs = desiredTs
    } while (isDotNotFound)

    return Math.ceil(desiredTs)
  }

  return {
    getMoneyTodaySum,
    getMoneyYesterdaySum,
    getMoneySpeed,
    getMoneyGraphData,
    getMoneyChange,
    getAdBudget,
    getFakeMoney,
    getAdMoneyTimeEnd,
    simplify,
  }
}

