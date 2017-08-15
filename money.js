import traffic from 'wt-traffic'
const last = array => array[array.length-1]
const AD_ENDED = 2

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
    return ({ timeStamp, trafSpeed, dot, dotPeriod }) => {
      const sumPeriodMoney = adList.reduce((total, adPacket) => {
        const { startDate, earned, moneyRatio, budget, endDate } = adPacket
        const earnedTs = adPacket.earnedTs || startDate
        const adRatio = getSiteAdRatio([ adPacket ], dots, timeStamp, true)

        if (adRatio === 0) {
          const prevDotAdRatio = getSiteAdRatio([ adPacket ], dots, dot.ts, true)
          if (prevDotAdRatio > 0) {
            // money between earned dot and previous dot
            const uncountedMoney = earnedTs < dot.ts ? getDataSum(dots, earnedTs, dot.ts) * moneyRatio : 0
            return total += budget - earned - uncountedMoney
          }
          if (startDate >= dot.ts && trafSpeed * moneyRatio > budget) {
            // ad between two points
            return total += budget
          }
        }

        return total += trafSpeed * adRatio * dotPeriod
      }, 0)

      // return money speed
      return dotPeriod > 0 ? sumPeriodMoney / dotPeriod : 0
    }
  }

  const getMoneySum = (adList, dots, fromTs, toTs) => {
    const filteredAdList = filterAdList(adList, fromTs, toTs)

    return filteredAdList.reduce((sum, adPacket) => {
      const { startDate, endDate, earnedTs, status } = adPacket
      // accelerated processing of ads that are placed in the "fromTs - toTs" range
      if (status === AD_ENDED && startDate >= fromTs && earnedTs <= toTs) return sum += adPacket.earned

      const converter = convertToMoney([ adPacket ], dots)
      const realToTs = Math.min(toTs, endDate)
      return sum += getDataSum(dots, fromTs, realToTs, converter)
    }, 0)
  }

  const getMoneyTodaySum = (adList, dots) => {
    if (!adList || !adList.length || !dots || !dots.length) return 0

    const { timeStartDay, timeNow } = getTimeStamps()
    return getMoneySum(adList, dots, timeStartDay, timeNow)
  }

  const getMoneyYesterdaySum = (adList, dots) => {
    if (!adList || !adList.length || !dots || !dots.length) return 0

    const timeStamp = moment().subtract(1, 'day').unix()
    const { timeStartDay, timeEndDay } = getTimeStamps(timeStamp)
    return getMoneySum(adList, dots, timeStartDay, timeEndDay)
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

