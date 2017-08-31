import traffic from 'wt-traffic'

const MIN_GRAPH_INTERVAL = 60 * 60
const AD_ENDED = 2
const AD_ACTIVE = 1
const last = array => array[ array.length - 1 ]
const isObject = a => !!a && a.constructor === Object

export default (moment) => {
  const {
    calcGraphX,
    getTimeStamps, 
    getDataSum, 
    getTrafficGraphData, 
    getTrafficSpeed,
    simplify,
    numberCompare,
  } = traffic(moment)

  const getSiteAdRatio = (adList, dots, timeStamp, isConverter = false) => {
    if (!Array.isArray(adList)) throw 'getSiteAdRatio. adList is not array'
    if (!Array.isArray(dots)) throw 'getSiteAdRatio. dots is not array'
    if (typeof timeStamp !== 'number') throw 'getSiteAdRatio. timeStamp is not a number'

    return adList.reduce((sumRatio, adPacket) => {
      const { moneyRatio, startDate, earned, status, earnedTs, budget } = adPacket

      if (status !== AD_ENDED && status !== AD_ACTIVE) return sumRatio

      const isEnded = status === AD_ENDED || (earnedTs && earned >= budget)
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
  }

  const filterAdList = (adList, fromTs, toTs) => adList.filter(adPacket => {
    const { startDate, status, earnedTs } = adPacket

    if (status !== AD_ENDED && status !== AD_ACTIVE) return false

    const endDate = status === AD_ENDED ? earnedTs : adPacket.endDate
    const fromTsInInterval = fromTs >= startDate && fromTs <= endDate
    const toTsInInterval = toTs >= startDate && toTs <= endDate

    if (fromTsInInterval || toTsInInterval) return true
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

          if (startDate >= dot.ts && startDate < timeStamp && trafSpeed * moneyRatio * dotPeriod > budget) {
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
    if (!Array.isArray(adList)) throw 'getMoneySum. adList is not array'
    if (!Array.isArray(dots)) throw 'getMoneySum. dots is not array'
    if (typeof fromTs !== 'number') throw 'getMoneySum. fromTs is not a number'
    if (typeof toTs !== 'number') throw 'getMoneySum. fromTs is not a number'

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
    if (!Array.isArray(adList)) throw 'getMoneyTodaySum. adList is not array'
    if (!Array.isArray(dots)) throw 'getMoneyTodaySum. dots is not array'
    if (!adList.length || !dots.length) return 0

    const { timeStartDay, timeNow } = getTimeStamps()

    return getMoneySum(adList, dots, timeStartDay, timeNow)
  }

  const getMoneyYesterdaySum = (adList, dots) => {
    if (!Array.isArray(adList)) throw 'getMoneyYesterdaySum. adList is not array'
    if (!Array.isArray(dots)) throw 'getMoneyYesterdaySum. dots is not array'
    if (!adList.length || !dots.length) return 0

    const timeStamp = moment().subtract(1, 'day').unix()
    const { timeStartDay, timeEndDay } = getTimeStamps(timeStamp)

    return getMoneySum(adList, dots, timeStartDay, timeEndDay)
  }

  const getMoneySpeed = (adList, dots, period = 'today', timeStamp = null) => {
    if (!Array.isArray(adList)) throw 'getMoneySpeed. adList is not array'
    if (!Array.isArray(dots)) throw 'getMoneySpeed. dots is not array'
    if (!adList.length || !dots.length) return 0

    const { timeNow } = getTimeStamps()
    let time = timeNow

    if (period === 'yesterday') time = moment(timeNow * 1000).subtract(1, 'day').unix()
    if (timeStamp) time = timeStamp

    return getTrafficSpeed(dots, period, time).total * getSiteAdRatio(adList, dots, time)
  }

  const getMoneyGraphData = (adList, dots, period = 'today') => {
    if (!Array.isArray(adList)) throw 'getMoneyGraphData. adList is not array'
    if (!Array.isArray(dots)) throw 'getMoneyGraphData. dots is not array'
    if (!adList.length || !dots.length) return []

    return getTrafficGraphData(dots, period).map(dot => ({
      ...dot,
      y: dot.y * getSiteAdRatio(adList, dots, dot.ts),
    }))
  }

  const getMoneyChange = (adList, dots) => {
    if (!Array.isArray(adList)) throw 'getMoneyChange. adList is not array'
    if (!Array.isArray(dots)) throw 'getMoneyChange. dots is not array'
    if (!adList.length || !dots.length) return 0

    const nowSpeed = getMoneySpeed(adList, dots, 'today')
    const yesterdaySpeed = getMoneySpeed(adList, dots, 'yesterday')

    return numberCompare(nowSpeed, yesterdaySpeed)
  }

  const getAdBudget = (adPacket, dots, timeStamp = null) => {
    if (!isObject(adPacket)) throw 'getAdBudget. adPacket is not a object'
    if (!Array.isArray(dots)) throw 'getAdBudget. dots is not array'
    if (!adPacket || !dots.length) return 0

    const timeNow = moment().unix()
    const { moneyRatio, earned, budget, startDate } = adPacket
    const earnedTs = adPacket.earnedTs || startDate
    const processedMoney = getDataSum(dots, earnedTs, timeStamp || timeNow) * moneyRatio

    return Math.min(budget, earned + processedMoney)
  }

  const getFakeMoney = (adList, dots, timeStamp = null) => {
    if (!Array.isArray(adList)) throw 'getFakeMoney. adList is not array'
    if (!Array.isArray(dots)) throw 'getFakeMoney. dots is not array'
    if (!adList.length || !dots.length) return 0

    timeStamp = timeStamp || moment().unix()

    const lastDotTimeStamp = last(dots.sort((a, b) => a.ts - b.ts)).ts
    const filteredAdList = filterAdList(adList, lastDotTimeStamp, timeStamp)
    const converter = convertToMoney(filteredAdList, dots)

    return getDataSum(dots, lastDotTimeStamp, timeStamp, converter)
  }

  const getAdMoneyTimeEnd = (adPacket, dots) => {
    if (!isObject(adPacket)) throw 'getAdMoneyTimeEnd. adPacket is not a object'
    if (!Array.isArray(dots)) throw 'getAdMoneyTimeEnd. dots is not array'

    const { moneyRatio, startDate, earned, earnedTs, budget, endDate } = adPacket
    const fakePeriodStart = earnedTs || startDate

    if (earnedTs && earned >= budget) return earnedTs
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

  const getAllSitesMoney = (sites, period = 'today') => {
    if (!Array.isArray(sites)) throw 'getAllSitesMoney. sites is not array'

    const timeStamp = period === 'yesterday' ? moment().subtract(1, 'day').unix() : moment().unix()
    const { timeStartDay, timeEndDay, timeNow } = getTimeStamps(timeStamp)
    let dots = []

    for (let dotTs = timeStartDay; dotTs <= timeEndDay; dotTs += MIN_GRAPH_INTERVAL) {
      dots.push(getAllSitesMoneyDotInfo(sites, dotTs, timeEndDay, timeNow))

      if (timeStamp > dotTs && timeStamp < dotTs + MIN_GRAPH_INTERVAL) {
        dots.push(getAllSitesMoneyDotInfo(sites, timeStamp, timeEndDay, timeNow))
      }
    }

    return dots
  }

  const getAllSitesMoneyDotInfo = (sites, dotTs, timeEndDay = null, timeNow = null) => {
    if (!Array.isArray(sites)) throw 'getAllSitesMoneyDotInfo. sites is not array'
    if (typeof dotTs !== 'number') throw 'getAllSitesMoneyDotInfo. dotTs is not a number'

    const isFuture = dotTs > timeNow
    const x = dotTs === timeEndDay ? 1 : calcGraphX(dotTs)
    const speed = sites.reduce((totalSpeed, curSite) => totalSpeed += getMoneySpeed(curSite.ad, curSite.siteSpeed, null, dotTs), 0)

    return {
      speed,
      isFuture,
      ts: dotTs,
      y: speed,
      x,
    }
  }

  const getAllSitesMoneyChange = sites => {
    if (!Array.isArray(sites)) throw 'getAllSitesMoneyChange. sites is not array'

    const timeStamp = moment().subtract(1, 'day').unix()
    const { timeNow } = getTimeStamps()
    const nowSpeed = getAllSitesMoneyDotInfo(sites, timeNow).speed
    const yesterdaySpeed = getAllSitesMoneyDotInfo(sites, timeStamp).speed

    return numberCompare(nowSpeed, yesterdaySpeed)
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
    getAllSitesMoney,
    getAllSitesMoneyChange,
    simplify,
  }
}
