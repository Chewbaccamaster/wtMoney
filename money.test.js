import lib from './index'
import moment from 'moment'

const { 
  simplify,
  getMoneyTodaySum,
  getMoneyYesterdaySum,
  getMoneySpeed,
  getMoneyGraphData,
  getMoneyChange,
  getAllSitesMoney,
  getAllSitesMoneyChange,
  getAdBudget,
  getFakeMoney,
  getAdMoneyTimeEnd,
} = lib(moment)

import { range } from 'ramda'

const startDay = moment.unix(0)
  .utc()
  .subtract(1, 'hours')
  .startOf('day')
  .add(1, 'hours')
  .add(5, 'days')
  .unix()
const endDate = moment.unix(startDay).add(1, 'day').unix()

moment.now = jest.fn(() => (startDay + 1 * 60 * 60) * 1000)

const adPacket10000 = {
  startDate: moment.unix(startDay).subtract(1, 'day').unix(),
  endDate: moment.unix(endDate).add(1, 'day').unix(),
  endDateMoney: null,
  budget: 10000,
  moneyRatio: 0.1,
  earned: 0,
  earnedTs: null,
}
const adPacket100 = {
  startDate: moment.unix(startDay).subtract(1, 'day').unix(),
  endDate: moment.unix(endDate).add(1, 'day').unix(),
  endDateMoney: null,
  budget: 100,
  moneyRatio: 0.1,
  earned: 0,
  earnedTs: null,
}
const dot1000 = {
  mail: 0,
  market: 1000,
  ref: 0,
  retention: 0,
  seo: 0,
  smm: 0,
  ts: startDay,
  limit: 100000,
}
const dotGeneric = {
  mail: 1000,
  market: 1,
  ref: 2,
  retention: 3,
  seo: 1000,
  smm: 1000,
  ts: startDay,
  limit: 100000,
}
const endYesterdayDot = {
  ...dot1000,
  ts: moment.unix(startDay).subtract(1, 'day').unix(),
  limit: 100000,
}

describe('getMoneyTodaySum', function() {
  test('should return 1000 * 0.1', () => {
    expect(getMoneyTodaySum(
      [ adPacket10000 ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(simplify(1000 * 0.1))
  })
  test('should return 10', () => {
    expect(getMoneyTodaySum(
      [ {
        ...adPacket10000,
        startDate: startDay + 10,
        budget: 10,
      } ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(simplify(10))
  })
  test('should return 10', () => {
    expect(getMoneyTodaySum(
      [ {
        ...adPacket10000,
        startDate: startDay + 10,
        budget: 10,
      } ],
      [ 
        dot1000,
        { ...dot1000, ts: startDay + 5 },
        { ...dot1000, ts: startDay + 10 },
      ]
    )).toBe(simplify(10))
  })
  test('should return 83', () => {
    expect(getMoneyTodaySum(
      [ {
        ...adPacket10000,
        startDate: startDay - 60 * 60,
        earned: 5,
        earnedTs: startDay,
        budget: 88,
      } ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(simplify(83))
  })
  test('should return 50', () => {
    expect(getMoneyTodaySum(
      [ {
        ...adPacket10000,
        startDate: startDay,
        endDate: startDay + 60 * 30,
      } ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(simplify(50))
  })
  test('should return 100 * 0.1', () => {
    expect(getMoneyTodaySum(
      [ adPacket10000 ],
      [ { 
        ...endYesterdayDot,
        limit: 50,
      }, { 
        ...dot1000,
        limit: 50,
      } ],
    )).toBe(simplify(50 * 0.1))
  })
  test('should return 0', () => {
    expect(getMoneyTodaySum(
      [ ],
      [ ]
    )).toBe(0)
  })
  test('should return throw', () => {
    expect(() => getMoneyTodaySum()).toThrow()
    expect(() => getMoneyTodaySum({})).toThrow()
    expect(() => getMoneyTodaySum([], {})).toThrow()
  })
})

describe('getMoneyYesterdaySum', function() {
  test('should return 2400', () => {
    expect(getMoneyYesterdaySum(
      [ adPacket10000 ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(2400)
  })
  test('should return 88', () => {
    expect(getMoneyYesterdaySum(
      [ {
        ...adPacket10000,
        budget: 133,
      } ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(simplify(133))
  })
  test('should return 120', () => {
    expect(getMoneyYesterdaySum(
      [ adPacket10000 ],
      [ { 
        ...endYesterdayDot,
        limit: 50,
      }, { 
        ...dot1000,
        limit: 50,
      } ],
    )).toBe(120)
  })
  test('should return 250', () => {
    expect(getMoneyYesterdaySum(
      [ {
        ...adPacket10000,
        startDate: endYesterdayDot.ts,
        endDate: endYesterdayDot.ts + 60 * 60 * 2.5,
      } ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(simplify(250))
  })
  test('should return 2.4', () => {
    expect(getMoneyYesterdaySum(
      [ adPacket10000 ],
      [ { 
        ...endYesterdayDot,
        limit: 1,
      }, { 
        ...dot1000,
        limit: 1,
      } ],
    )).toBe(2.4)
  })
  test('should return 0', () => {
    expect(getMoneyYesterdaySum(
      [ ],
      [ ]
    )).toBe(0)
  })
  test('should return throw', () => {
    expect(() => getMoneyYesterdaySum()).toThrow()
    expect(() => getMoneyYesterdaySum({})).toThrow()
    expect(() => getMoneyYesterdaySum([], {})).toThrow()
  })
})

describe('getMoneySpeed', function() {
  test('should return 100', () => {
    expect(getMoneySpeed(
      [ adPacket100 ],
      [ dot1000 ]
    )).toBe(100)
  })
  test('should return 100', () => {
    expect(getMoneySpeed(
      [ adPacket10000, adPacket100 ],
      [ dot1000 ]
    )).toBe(200)
  })
  test('should return 0', () => {
    expect(getMoneySpeed(
      [ {
        ...adPacket100,
        budget: adPacket100.budget - 1,
      } ],
      [ dot1000 ]
    )).toBe(0)
    expect(getMoneySpeed(
      [ ],
      [ ]
    )).toBe(0)
  })
  test('should return throw', () => {
    expect(() => getMoneySpeed()).toThrow()
    expect(() => getMoneySpeed({})).toThrow()
    expect(() => getMoneySpeed([], {})).toThrow()
  })
})

describe('getMoneyGraphData', function() {
  test('should return 2 dots', () => {
    expect(getMoneyGraphData(
      [ adPacket10000, adPacket100 ],
      [ dotGeneric ]
    )).toEqual([
      {
        x: 0,
        y: (3000 * 0.1 + 1 + 2 + 3) * 0.2,
        ts: startDay,
        isTrimmed: false,
      },
      {
        x: simplify(1 / 24, 4),
        y: (3000 * 0.12 + 1 + 2 + 3) * 0.2,
        ts: startDay + 60 * 60,
        isTrimmed: false,
      },
    ])
  })
  test('should return many dots', () => {
    expect(getMoneyGraphData(
      [ adPacket10000, adPacket100 ],
      [ endYesterdayDot ],
      'yesterday'
    )).toEqual(
      range(0, 25).map(index => ({
        x: simplify(index / 24, 4),
        y: 1000 * (index <= 1 ? 0.2 : 0.1),
        ts: moment.unix(startDay).subtract(1, 'day').add(index, 'hour').unix(),
        isTrimmed: false,
      }))
    )
  })
  test('should return many dots', () => {
    expect(getMoneyGraphData(
      [ adPacket100 ],
      [ { 
        ...endYesterdayDot,
        limit: 50,
      } ],
      'yesterday',
    )).toEqual(
      range(0, 25).map(index => ({
        x: simplify(index / 24, 4),
        y: index <= 20 ? 5 : 0,
        ts: moment.unix(startDay).subtract(1, 'day').add(index, 'hour').unix(),
        isTrimmed: true,
      }))
    )
  })
  test('should return []', () => {
    expect(getMoneyGraphData(
      [ adPacket10000 ],
      [ ]
    )).toEqual([ ])
    expect(getMoneyGraphData(
      [ ],
      [ ]
    )).toEqual([ ])
  })
  test('should return throw', () => {
    expect(() => getMoneyGraphData()).toThrow()
    expect(() => getMoneyGraphData({})).toThrow()
    expect(() => getMoneyGraphData([], {})).toThrow()
  })
})

describe('getMoneyChange', function() {
  test('should return 1', () => {
    expect(getMoneyChange(
      [ { 
        ...adPacket10000,
        startDate: startDay,
      } ],
      [ dotGeneric ]
    )).toBe(1)
  })
  test('should return -1', () => {
    expect(getMoneyChange(
      [ { 
        ...adPacket10000,
        endDate: startDay,
      } ],
      [ dotGeneric ]
    )).toBe(-1)
  })
  test('should return 0', () => {
    expect(getMoneyChange(
      [ adPacket10000 ],
      [ dotGeneric ]
    )).toBe(0)
    expect(getMoneyChange(
      [ ],
      [ ]
    )).toBe(0)
  })
  test('should return throw', () => {
    expect(() => getMoneyChange()).toThrow()
    expect(() => getMoneyChange({})).toThrow()
    expect(() => getMoneyChange([], {})).toThrow()
  })
})

describe('getAdBudget', function() {
  test('should return 2500', () => {
    expect(getAdBudget(
      adPacket10000,
      [ endYesterdayDot, dot1000 ]
    )).toBe(25 * 100)
  })
  test('should return 57', () => {
    expect(getAdBudget(
      {
        ...adPacket10000,
        budget: 57,
      },
      [ endYesterdayDot, dot1000 ]
    )).toBe(57)
  })
  test('should return 100', () => {
    expect(getAdBudget(
      { 
        ...adPacket10000,
        startDate: startDay,
      },
      [ endYesterdayDot, dot1000 ]
    )).toBe(100)
  })
  test('should return throw', () => {
    expect(() => getAdBudget()).toThrow()
    expect(() => getAdBudget([])).toThrow()
    expect(() => getAdBudget({}, {})).toThrow()
  })
})

describe('getFakeMoney', function() {
  test('should return 2500', () => {
    expect(getFakeMoney(
      [ adPacket10000 ],
      [ endYesterdayDot ]
    )).toBe(2500)
  })
  test('should return 100', () => {
    expect(getFakeMoney(
      [ adPacket10000 ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(100)
  })
  test('should return 50', () => {
    expect(getFakeMoney(
      [ { ...adPacket10000, startDate: startDay + 30 * 60 } ],
      [ dot1000, { ...dot1000, ts: startDay + 30 * 60 } ]
    )).toBe(50)
  })
  test('should return 0', () => {
    expect(getFakeMoney(
      [ ],
      [ endYesterdayDot, dot1000 ]
    )).toBe(0)
  })
  test('should return throw', () => {
    expect(() => getFakeMoney()).toThrow()
    expect(() => getFakeMoney({})).toThrow()
    expect(() => getFakeMoney([], {})).toThrow()
  })
})

describe('getAdMoneyTimeEnd', function() {
  test('should return < 5', () => {
    expect(
      getAdMoneyTimeEnd(
        { 
          ...adPacket10000,
          budget: 100,
        },
        [ endYesterdayDot ]
      )
      - (adPacket10000.startDate + 60 * 60)
    ).toBeLessThan(5)
    expect(
      getAdMoneyTimeEnd(
        { 
          ...adPacket10000,
          budget: 1000,
        },
        [ endYesterdayDot ]
      )
      - (adPacket10000.startDate + 10 * 60 * 60)
    ).toBeLessThan(5)
    expect(
      getAdMoneyTimeEnd(
        { 
          ...adPacket10000,
          budget: 0,
        },
        [ endYesterdayDot ]
      )
      - adPacket10000.startDate
    ).toBeLessThan(5)
  })
  test('should return throw', () => {
    expect(() => getAdMoneyTimeEnd()).toThrow()
    expect(() => getAdMoneyTimeEnd([])).toThrow()
    expect(() => getAdMoneyTimeEnd({}, {})).toThrow()
  })
})

describe('getAllSitesMoney', function() {
  test('should return array of object. speed = 100', () => {
    expect(getAllSitesMoney(
      [
        { id: 1, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ adPacket10000 ] },
      ]
    )).toEqual(
      range(0, 25).map(index => ({
        x: simplify(index / 24, 4),
        y: 100,
        speed: 100,
        ts: startDay + 60 * 60 * index,
        isFuture: index > 1,
      }))
    )
  })
  test('should return array of object. Last dot speed = 0', () => {
    const result = range(0, 25).map(index => ({
      y: index < 24 ? 100 : 0,
      speed: index < 24 ? 100 : 0,
    }))
    expect(getAllSitesMoney(
      [ { id: 1, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ { ...adPacket10000, endDate: endDate - 60 * 60 } ] } ]
    )).toMatchObject(result)
    expect(getAllSitesMoney(
      [ { id: 1, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ { ...adPacket10000, budget: 4700 } ] } ]
    )).toMatchObject(result)
  })
  test('should return throw', () => {
    expect(() => getAllSitesMoney()).toThrow()
    expect(() => getAllSitesMoney({})).toThrow()
  })
})

describe('getAllSitesMoneyChange', function() {
  test('should return 0', () => {
    expect(getAllSitesMoneyChange(
      [
        { id: 1, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ adPacket10000 ] },
        { id: 2, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ adPacket10000 ] },
      ]
    )).toEqual(0)
    expect(getAllSitesMoneyChange(
      [
        { id: 1, siteSpeed: [ ], ad: [ ] },
        { id: 2, siteSpeed: [ ], ad: [ ] },
      ]
    )).toEqual(0)
  })
  test('should return -1', () => {
    expect(getAllSitesMoneyChange(
      [
        { id: 1, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ { ...adPacket10000, endDate: startDay } ] },
        { id: 2, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ adPacket10000 ] },
      ]
    )).toEqual(-1)
  })
  test('should return 1', () => {
    expect(getAllSitesMoneyChange(
      [
        { id: 1, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ { ...adPacket10000, startDate: startDay } ] },
        { id: 2, siteSpeed: [ endYesterdayDot, dot1000 ], ad: [ adPacket10000 ] },
      ]
    )).toEqual(1)
  })
  test('should return throw', () => {
    expect(() => getAllSitesMoney()).toThrow()
    expect(() => getAllSitesMoney({})).toThrow()
  })
})
