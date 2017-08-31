'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _wtTraffic = require('wt-traffic');

var _wtTraffic2 = _interopRequireDefault(_wtTraffic);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var MIN_GRAPH_INTERVAL = 60 * 60;
var AD_ENDED = 2;
var AD_ACTIVE = 1;
var last = function last(array) {
  return array[array.length - 1];
};
var isObject = function isObject(a) {
  return !!a && a.constructor === Object;
};

exports.default = function (moment) {
  var _traffic = (0, _wtTraffic2.default)(moment),
      calcGraphX = _traffic.calcGraphX,
      getTimeStamps = _traffic.getTimeStamps,
      getDataSum = _traffic.getDataSum,
      getTrafficGraphData = _traffic.getTrafficGraphData,
      getTrafficSpeed = _traffic.getTrafficSpeed,
      simplify = _traffic.simplify,
      numberCompare = _traffic.numberCompare;

  var getSiteAdRatio = function getSiteAdRatio(adList, dots, timeStamp) {
    var isConverter = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

    if (!Array.isArray(adList)) throw 'getSiteAdRatio. adList is not array';
    if (!Array.isArray(dots)) throw 'getSiteAdRatio. dots is not array';
    if (typeof timeStamp !== 'number') throw 'getSiteAdRatio. timeStamp is not a number';

    return adList.reduce(function (sumRatio, adPacket) {
      var moneyRatio = adPacket.moneyRatio,
          startDate = adPacket.startDate,
          earned = adPacket.earned,
          status = adPacket.status,
          earnedTs = adPacket.earnedTs,
          budget = adPacket.budget;


      if (status !== AD_ENDED && status !== AD_ACTIVE) return sumRatio;

      var isEnded = status === AD_ENDED || earnedTs && earned >= budget;
      var endDate = isEnded ? earnedTs : adPacket.endDate;
      var inInterval = isConverter ? timeStamp > startDate && timeStamp <= endDate : timeStamp >= startDate && timeStamp <= endDate;
      var fakePeriodStart = earnedTs || startDate;
      var tsInFakePeriod = !isEnded && timeStamp > fakePeriodStart;
      var isEndedInFakePeriod = false;

      if (inInterval && tsInFakePeriod) {
        var processedMoney = getDataSum(dots, fakePeriodStart, timeStamp) * moneyRatio;
        isEndedInFakePeriod = earned + processedMoney > budget;
      }

      return sumRatio += inInterval && !isEndedInFakePeriod ? moneyRatio : 0;
    }, 0);
  };

  var filterAdList = function filterAdList(adList, fromTs, toTs) {
    return adList.filter(function (adPacket) {
      var startDate = adPacket.startDate,
          status = adPacket.status,
          earnedTs = adPacket.earnedTs;


      if (status !== AD_ENDED && status !== AD_ACTIVE) return false;

      var endDate = status === AD_ENDED ? earnedTs : adPacket.endDate;
      var fromTsInInterval = fromTs >= startDate && fromTs <= endDate;
      var toTsInInterval = toTs >= startDate && toTs <= endDate;

      if (fromTsInInterval || toTsInInterval) return true;
    });
  };

  var convertToMoney = function convertToMoney(adList, dots) {
    return function (_ref) {
      var timeStamp = _ref.timeStamp,
          trafSpeed = _ref.trafSpeed,
          dot = _ref.dot,
          dotPeriod = _ref.dotPeriod;

      var sumPeriodMoney = adList.reduce(function (total, adPacket) {
        var startDate = adPacket.startDate,
            earned = adPacket.earned,
            moneyRatio = adPacket.moneyRatio,
            budget = adPacket.budget,
            endDate = adPacket.endDate;

        var earnedTs = adPacket.earnedTs || startDate;
        var adRatio = getSiteAdRatio([adPacket], dots, timeStamp, true);

        if (adRatio === 0) {
          var prevDotAdRatio = getSiteAdRatio([adPacket], dots, dot.ts, true);

          if (prevDotAdRatio > 0) {
            // money between earned dot and previous dot
            var uncountedMoney = earnedTs < dot.ts ? getDataSum(dots, earnedTs, dot.ts) * moneyRatio : 0;
            return total += budget - earned - uncountedMoney;
          }

          if (startDate >= dot.ts && startDate < timeStamp && trafSpeed * moneyRatio * dotPeriod > budget) {
            // ad between two points
            return total += budget;
          }
        }

        return total += trafSpeed * adRatio * dotPeriod;
      }, 0);

      // return money speed
      return dotPeriod > 0 ? sumPeriodMoney / dotPeriod : 0;
    };
  };

  var getMoneySum = function getMoneySum(adList, dots, fromTs, toTs) {
    if (!Array.isArray(adList)) throw 'getMoneySum. adList is not array';
    if (!Array.isArray(dots)) throw 'getMoneySum. dots is not array';
    if (typeof fromTs !== 'number') throw 'getMoneySum. fromTs is not a number';
    if (typeof toTs !== 'number') throw 'getMoneySum. fromTs is not a number';

    var filteredAdList = filterAdList(adList, fromTs, toTs);

    return filteredAdList.reduce(function (sum, adPacket) {
      var startDate = adPacket.startDate,
          endDate = adPacket.endDate,
          earnedTs = adPacket.earnedTs,
          status = adPacket.status;

      // accelerated processing of ads that are placed in the "fromTs - toTs" range

      if (status === AD_ENDED && startDate >= fromTs && earnedTs <= toTs) return sum += adPacket.earned;

      var converter = convertToMoney([adPacket], dots);
      var realToTs = Math.min(toTs, endDate);

      return sum += getDataSum(dots, fromTs, realToTs, converter);
    }, 0);
  };

  var getMoneyTodaySum = function getMoneyTodaySum(adList, dots) {
    if (!Array.isArray(adList)) throw 'getMoneyTodaySum. adList is not array';
    if (!Array.isArray(dots)) throw 'getMoneyTodaySum. dots is not array';
    if (!adList.length || !dots.length) return 0;

    var _getTimeStamps = getTimeStamps(),
        timeStartDay = _getTimeStamps.timeStartDay,
        timeNow = _getTimeStamps.timeNow;

    return getMoneySum(adList, dots, timeStartDay, timeNow);
  };

  var getMoneyYesterdaySum = function getMoneyYesterdaySum(adList, dots) {
    if (!Array.isArray(adList)) throw 'getMoneyYesterdaySum. adList is not array';
    if (!Array.isArray(dots)) throw 'getMoneyYesterdaySum. dots is not array';
    if (!adList.length || !dots.length) return 0;

    var timeStamp = moment().subtract(1, 'day').unix();

    var _getTimeStamps2 = getTimeStamps(timeStamp),
        timeStartDay = _getTimeStamps2.timeStartDay,
        timeEndDay = _getTimeStamps2.timeEndDay;

    return getMoneySum(adList, dots, timeStartDay, timeEndDay);
  };

  var getMoneySpeed = function getMoneySpeed(adList, dots) {
    var period = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'today';
    var timeStamp = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    if (!Array.isArray(adList)) throw 'getMoneySpeed. adList is not array';
    if (!Array.isArray(dots)) throw 'getMoneySpeed. dots is not array';
    if (!adList.length || !dots.length) return 0;

    var _getTimeStamps3 = getTimeStamps(),
        timeNow = _getTimeStamps3.timeNow;

    var time = timeNow;

    if (period === 'yesterday') time = moment(timeNow * 1000).subtract(1, 'day').unix();
    if (timeStamp) time = timeStamp;

    return getTrafficSpeed(dots, period, time).total * getSiteAdRatio(adList, dots, time);
  };

  var getMoneyGraphData = function getMoneyGraphData(adList, dots) {
    var period = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'today';

    if (!Array.isArray(adList)) throw 'getMoneyGraphData. adList is not array';
    if (!Array.isArray(dots)) throw 'getMoneyGraphData. dots is not array';
    if (!adList.length || !dots.length) return [];

    return getTrafficGraphData(dots, period).map(function (dot) {
      return _extends({}, dot, {
        y: dot.y * getSiteAdRatio(adList, dots, dot.ts)
      });
    });
  };

  var getMoneyChange = function getMoneyChange(adList, dots) {
    if (!Array.isArray(adList)) throw 'getMoneyChange. adList is not array';
    if (!Array.isArray(dots)) throw 'getMoneyChange. dots is not array';
    if (!adList.length || !dots.length) return 0;

    var nowSpeed = getMoneySpeed(adList, dots, 'today');
    var yesterdaySpeed = getMoneySpeed(adList, dots, 'yesterday');

    return numberCompare(nowSpeed, yesterdaySpeed);
  };

  var getAdBudget = function getAdBudget(adPacket, dots) {
    var timeStamp = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    if (!isObject(adPacket)) throw 'getAdBudget. adPacket is not a object';
    if (!Array.isArray(dots)) throw 'getAdBudget. dots is not array';
    if (!adPacket || !dots.length) return 0;

    var timeNow = moment().unix();
    var moneyRatio = adPacket.moneyRatio,
        earned = adPacket.earned,
        budget = adPacket.budget,
        startDate = adPacket.startDate;

    var earnedTs = adPacket.earnedTs || startDate;
    var processedMoney = getDataSum(dots, earnedTs, timeStamp || timeNow) * moneyRatio;

    return Math.min(budget, earned + processedMoney);
  };

  var getFakeMoney = function getFakeMoney(adList, dots) {
    var timeStamp = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    if (!Array.isArray(adList)) throw 'getFakeMoney. adList is not array';
    if (!Array.isArray(dots)) throw 'getFakeMoney. dots is not array';
    if (!adList.length || !dots.length) return 0;

    timeStamp = timeStamp || moment().unix();

    var lastDotTimeStamp = last(dots.sort(function (a, b) {
      return a.ts - b.ts;
    })).ts;
    var filteredAdList = filterAdList(adList, lastDotTimeStamp, timeStamp);
    var converter = convertToMoney(filteredAdList, dots);

    return getDataSum(dots, lastDotTimeStamp, timeStamp, converter);
  };

  var getAdMoneyTimeEnd = function getAdMoneyTimeEnd(adPacket, dots) {
    if (!isObject(adPacket)) throw 'getAdMoneyTimeEnd. adPacket is not a object';
    if (!Array.isArray(dots)) throw 'getAdMoneyTimeEnd. dots is not array';

    var moneyRatio = adPacket.moneyRatio,
        startDate = adPacket.startDate,
        earned = adPacket.earned,
        earnedTs = adPacket.earnedTs,
        budget = adPacket.budget,
        endDate = adPacket.endDate;

    var fakePeriodStart = earnedTs || startDate;

    if (earnedTs && earned >= budget) return earnedTs;
    if (earned + getDataSum(dots, fakePeriodStart, endDate) * moneyRatio <= budget) return endDate;

    var restMoney = budget - earned;
    var desiredFromTs = fakePeriodStart;
    var desiredToTs = endDate;
    var desiredTs = null;
    var deltaMoney = restMoney;
    var isDotNotFound = true;

    do {
      desiredTs = (desiredToTs + desiredFromTs) / 2;
      deltaMoney = restMoney - getDataSum(dots, fakePeriodStart, desiredTs) * moneyRatio;
      isDotNotFound = Math.abs(desiredToTs - desiredFromTs) > 5;

      if (deltaMoney >= 0) desiredFromTs = desiredTs;
      if (deltaMoney <= 0) desiredToTs = desiredTs;
    } while (isDotNotFound);

    return Math.ceil(desiredTs);
  };

  var getAllSitesMoney = function getAllSitesMoney(sites) {
    var period = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'today';

    if (!Array.isArray(sites)) throw 'getAllSitesMoney. sites is not array';

    var timeStamp = period === 'yesterday' ? moment().subtract(1, 'day').unix() : moment().unix();

    var _getTimeStamps4 = getTimeStamps(timeStamp),
        timeStartDay = _getTimeStamps4.timeStartDay,
        timeEndDay = _getTimeStamps4.timeEndDay,
        timeNow = _getTimeStamps4.timeNow;

    var dots = [];

    for (var dotTs = timeStartDay; dotTs <= timeEndDay; dotTs += MIN_GRAPH_INTERVAL) {
      dots.push(getAllSitesMoneyDotInfo(sites, dotTs, timeEndDay, timeNow));

      if (timeStamp > dotTs && timeStamp < dotTs + MIN_GRAPH_INTERVAL) {
        dots.push(getAllSitesMoneyDotInfo(sites, timeStamp, timeEndDay, timeNow));
      }
    }

    return dots;
  };

  var getAllSitesMoneyDotInfo = function getAllSitesMoneyDotInfo(sites, dotTs) {
    var timeEndDay = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var timeNow = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    if (!Array.isArray(sites)) throw 'getAllSitesMoneyDotInfo. sites is not array';
    if (typeof dotTs !== 'number') throw 'getAllSitesMoneyDotInfo. dotTs is not a number';

    var isFuture = dotTs > timeNow;
    var x = dotTs === timeEndDay ? 1 : calcGraphX(dotTs);
    var speed = sites.reduce(function (totalSpeed, curSite) {
      return totalSpeed += getMoneySpeed(curSite.ad, curSite.siteSpeed, null, dotTs);
    }, 0);

    return {
      speed: speed,
      isFuture: isFuture,
      ts: dotTs,
      y: speed,
      x: x
    };
  };

  var getAllSitesMoneyChange = function getAllSitesMoneyChange(sites) {
    if (!Array.isArray(sites)) throw 'getAllSitesMoneyChange. sites is not array';

    var timeStamp = moment().subtract(1, 'day').unix();

    var _getTimeStamps5 = getTimeStamps(),
        timeNow = _getTimeStamps5.timeNow;

    var nowSpeed = getAllSitesMoneyDotInfo(sites, timeNow).speed;
    var yesterdaySpeed = getAllSitesMoneyDotInfo(sites, timeStamp).speed;

    return numberCompare(nowSpeed, yesterdaySpeed);
  };

  return {
    getMoneyTodaySum: getMoneyTodaySum,
    getMoneyYesterdaySum: getMoneyYesterdaySum,
    getMoneySpeed: getMoneySpeed,
    getMoneyGraphData: getMoneyGraphData,
    getMoneyChange: getMoneyChange,
    getAdBudget: getAdBudget,
    getFakeMoney: getFakeMoney,
    getAdMoneyTimeEnd: getAdMoneyTimeEnd,
    getAllSitesMoney: getAllSitesMoney,
    getAllSitesMoneyChange: getAllSitesMoneyChange,
    simplify: simplify
  };
};
