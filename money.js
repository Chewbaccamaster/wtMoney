import { 
  moment, 
  getTimeStamps, 
  getDataSum, 
  getTrafficGraphData, 
  getTrafficSpeed,
} from './'

const getSiteAdRatio = (adList, dots, timeStamp) => adList.reduce((sumRatio, adPacket) => {
  const { moneyRatio, startDate, earned, earnedTs, budget } = adPacket
  const isEnded = earnedTs && earned >= budget
  const endDate = isEnded ? earnedTs : adPacket.endDate
  const inInterval = timeStamp >= startDate && timeStamp <= endDate
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
  return (timeStamp, trafSpeed) => trafSpeed * getSiteAdRatio(adList, dots, timeStamp)
}

export const getMoneyTodaySum = (adList, dots) => {
  if (!adList || !adList.length || !dots || !dots.length) return 0

  const { timeStartDay, timeNow } = getTimeStamps()
  const filteredAdList = filterAdList(adList, timeStartDay, timeNow)
  const converter = convertToMoney(filteredAdList, dots)

  return getDataSum(dots, timeStartDay, timeNow, converter)
}

export const getMoneyYesterdaySum = (adList, dots) => {
  if (!adList || !adList.length || !dots || !dots.length) return 0

  const timeStamp = moment().subtract(1, 'day').unix()
  const { timeStartDay, timeEndDay } = getTimeStamps(timeStamp)
  const filteredAdList = filterAdList(adList, timeStartDay, timeEndDay)
  const converter = convertToMoney(filteredAdList, dots)

  return getDataSum(dots, timeStartDay, timeEndDay, converter)
}

export const getMoneySpeed = (adList, dots, period = 'today') => {
  if (!adList || !adList.length || !dots || !dots.length) return 0

  const timeStamp = period === 'yesterday' ? moment().subtract(1, 'day').unix() : moment().unix()
  return getTrafficSpeed(dots, period).total * getSiteAdRatio(adList, dots, timeStamp)
}

export const getMoneyGraphData = (adList, dots, period = 'today') => {
  if (!adList || !adList.length || !dots || !dots.length) return []

  return getTrafficGraphData(dots, period).map(dot => ({
    ...dot,
    y: Math.round(dot.y * getSiteAdRatio(adList, dots, dot.ts)),
  }))
}

export const getMoneyChange = (adList, dots) => {
  if (!adList || !adList.length || !dots || !dots.length) return 0

  const nowSpeed = getMoneySpeed(adList, dots, 'today')
  const yesterdaySpeed = getMoneySpeed(adList, dots, 'yesterday')
  const delta = nowSpeed - yesterdaySpeed
  const equallyDelta = Math.max(5, Math.max(nowSpeed, yesterdaySpeed) * 0.05)

  if (Math.abs(delta) <= equallyDelta) return 0
  if (delta > 0) return 1
  return -1
}

export const getAdBudget = (adPacket, dots, timeStamp = null) => {
  if (!adPacket || !dots || !dots.length) return 0

  const timeNow = moment().unix()
  const { moneyRatio, earned, budget, startDate } = adPacket
  const earnedTs = adPacket.earnedTs || startDate
  const processedMoney = getDataSum(dots, earnedTs, timeStamp || timeNow) * moneyRatio
  return Math.min(budget, earned + processedMoney)
}
